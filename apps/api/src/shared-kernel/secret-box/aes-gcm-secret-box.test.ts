import { createDecipheriv, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { Keyring } from './key-provider.port.js';
import { SecretBoxError, type SecretBoxErrorCode } from './secret-box-error.js';
import {
  AesGcmSecretBox,
  MAX_ENVELOPE_LENGTH,
  MAX_PLAINTEXT_BYTES,
} from './infrastructure/aes-gcm-secret-box.js';

// Every key here is synthetic: a repeated byte or random bytes generated inside the test.
const KEY_A = Buffer.alloc(32, 0x11);
const KEY_B = Buffer.alloc(32, 0x22);
const CONTEXT = 'store:1:accessToken';
const PLAINTEXT = 'synthetic-credential-value-0001';

function keyring(
  entries: Record<string, Buffer>,
  activeKeyId = Object.keys(entries)[0] ?? 'k1',
): Keyring {
  return { activeKeyId, keys: new Map(Object.entries(entries)) };
}

function newBox(key: Buffer = KEY_A): AesGcmSecretBox {
  return new AesGcmSecretBox(keyring({ k1: key }));
}

function codeOf(action: () => unknown): SecretBoxErrorCode | 'NO_ERROR' | 'UNTYPED_ERROR' {
  try {
    action();
  } catch (error) {
    return error instanceof SecretBoxError ? error.code : 'UNTYPED_ERROR';
  }
  return 'NO_ERROR';
}

const segments = (envelope: string): string[] => envelope.split('.');
const join = (parts: string[]): string => parts.join('.');
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function flipBit(segment: string): string {
  const bytes = Buffer.from(segment, 'base64url');
  bytes[0] = (bytes[0] ?? 0) ^ 0x01;
  return bytes.toString('base64url');
}

function replaceSegment(envelope: string, index: number, value: string): string {
  const parts = segments(envelope);
  parts[index] = value;
  return join(parts);
}

function swapSegments(envelope: string, first: number, second: number): string {
  const parts = segments(envelope);
  const held = parts[first] ?? '';
  parts[first] = parts[second] ?? '';
  parts[second] = held;
  return join(parts);
}

function truncateBytes(segment: string, keep: number): string {
  return Buffer.from(segment, 'base64url').subarray(0, keep).toString('base64url');
}

describe('AesGcmSecretBox: construction', () => {
  it('fails with KEY_MISSING naming SECRET_KEY_FILE when there is no keyring', () => {
    let caught: unknown;
    try {
      new AesGcmSecretBox(null);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SecretBoxError);
    expect((caught as SecretBoxError).code).toBe('KEY_MISSING');
    expect((caught as SecretBoxError).message).toContain('SECRET_KEY_FILE');
  });

  it.each([0, 1, 16, 24, 31, 33, 64])(
    'rejects a %i-byte key with INVALID_KEY and never echoes it',
    (length) => {
      const seeded = randomBytes(length);
      let caught: unknown;
      try {
        new AesGcmSecretBox(keyring({ k1: seeded }));
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(SecretBoxError);
      const error = caught as SecretBoxError;
      expect(error.code).toBe('INVALID_KEY');
      // Short keys would match file paths by chance, so the leak check needs a distinctive length.
      if (length >= 16) {
        const dump = `${error.message} ${error.stack ?? ''} ${JSON.stringify(error, Object.getOwnPropertyNames(error))}`;
        for (const form of [
          seeded.toString('hex'),
          seeded.toString('base64'),
          seeded.toString('base64url'),
        ]) {
          expect(dump).not.toContain(form);
        }
      }
    },
  );

  it.each([
    ['an empty keyring', { activeKeyId: 'k1', keys: new Map<string, Uint8Array>() }],
    [
      'an active id that is not in the keyring',
      { activeKeyId: 'k9', keys: new Map([['k1', KEY_A]]) },
    ],
    ['a key id containing a dot', { activeKeyId: 'k.1', keys: new Map([['k.1', KEY_A]]) }],
    ['a key id containing a pipe', { activeKeyId: 'k|1', keys: new Map([['k|1', KEY_A]]) }],
    [
      'a key id that mimics an AAD split',
      { activeKeyId: 'k1|x', keys: new Map([['k1|x', KEY_A]]) },
    ],
    ['an empty key id', { activeKeyId: '', keys: new Map([['', KEY_A]]) }],
    [
      'a key id above 32 characters',
      { activeKeyId: 'k'.repeat(33), keys: new Map([['k'.repeat(33), KEY_A]]) },
    ],
  ])('rejects %s with INVALID_KEY', (_name, ring) => {
    expect(codeOf(() => new AesGcmSecretBox(ring))).toBe('INVALID_KEY');
  });

  it('keeps its own copy of the keys, so changing the caller buffer afterwards has no effect', () => {
    const mutable = Buffer.alloc(32, 0x33);
    const box = new AesGcmSecretBox(keyring({ k1: mutable }));
    const envelope = box.encrypt(PLAINTEXT, CONTEXT);
    mutable.fill(0x00);
    expect(box.decrypt(envelope, CONTEXT)).toBe(PLAINTEXT);
    expect(
      new AesGcmSecretBox(keyring({ k1: Buffer.alloc(32, 0x33) })).decrypt(envelope, CONTEXT),
    ).toBe(PLAINTEXT);
  });
});

describe('AesGcmSecretBox: round trip', () => {
  it.each([
    ['ASCII', PLAINTEXT],
    ['empty string', ''],
    ['single character', 'x'],
    ['long input', 'a1b2'.repeat(25_000)],
    ['multi-byte text', 'contraseña ñandú 日本語 Ω'],
    ['astral characters', 'token 😀 𝒳 end'],
    ['control characters and NUL', 'a\u0000b\nc\td'],
    ['a leading byte order mark', '﻿value'],
    ['separators used by the format', 'sb1.k1.a|b.c'],
    ['the largest accepted size', 'z'.repeat(MAX_PLAINTEXT_BYTES)],
  ])('decrypts %s back to the identical plaintext', (_name, plaintext) => {
    const box = newBox();
    expect(box.decrypt(box.encrypt(plaintext, CONTEXT), CONTEXT)).toBe(plaintext);
  });

  it('rejects an unpaired surrogate at encryption instead of silently altering it', () => {
    const box = newBox();
    expect(codeOf(() => box.encrypt('ab\ud800cd', CONTEXT))).toBe('INVALID_INPUT');
    expect(codeOf(() => box.encrypt('\udc00', CONTEXT))).toBe('INVALID_INPUT');
  });

  it('rejects plaintext above the size bound, a non-string plaintext and an empty or non-string context', () => {
    const box = newBox();
    expect(codeOf(() => box.encrypt('z'.repeat(MAX_PLAINTEXT_BYTES + 1), CONTEXT))).toBe(
      'INVALID_INPUT',
    );
    expect(codeOf(() => box.encrypt(42 as unknown as string, CONTEXT))).toBe('INVALID_INPUT');
    expect(codeOf(() => box.encrypt(PLAINTEXT, ''))).toBe('INVALID_INPUT');
    expect(codeOf(() => box.encrypt(PLAINTEXT, undefined as unknown as string))).toBe(
      'INVALID_INPUT',
    );
    expect(codeOf(() => box.decrypt(box.encrypt(PLAINTEXT, CONTEXT), ''))).toBe('INVALID_INPUT');
  });

  it('rejects a context with an unpaired surrogate, which would otherwise collide with U+FFFD', () => {
    const box = newBox();
    const envelope = box.encrypt(PLAINTEXT, 'a�b');
    expect(codeOf(() => box.encrypt(PLAINTEXT, 'a\ud800b'))).toBe('INVALID_INPUT');
    expect(codeOf(() => box.decrypt(envelope, 'a\ud800b'))).toBe('INVALID_INPUT');
  });

  it('produces a different envelope on every call, with a different IV each time', () => {
    const box = newBox();
    const first = box.encrypt(PLAINTEXT, CONTEXT);
    const second = box.encrypt(PLAINTEXT, CONTEXT);
    expect(first).not.toBe(second);
    expect(segments(first)[2]).not.toBe(segments(second)[2]);
    const ivs = new Set(
      Array.from({ length: 500 }, () => segments(box.encrypt(PLAINTEXT, CONTEXT))[2]),
    );
    expect(ivs.size).toBe(500);
  });

  it('does not contain the plaintext in any readable form', () => {
    const envelope = newBox().encrypt(PLAINTEXT, CONTEXT);
    const forms = [
      PLAINTEXT,
      Buffer.from(PLAINTEXT).toString('base64'),
      Buffer.from(PLAINTEXT).toString('base64url'),
      Buffer.from(PLAINTEXT).toString('hex'),
    ];
    for (const form of forms) expect(envelope).not.toContain(form);
  });
});

describe('AesGcmSecretBox: envelope format', () => {
  it('is sb1.<keyId>.<iv>.<ciphertext>.<tag> with a 12-byte IV and a 16-byte tag, base64url without padding', () => {
    const envelope = newBox().encrypt(PLAINTEXT, CONTEXT);
    const [version, keyId, iv, ciphertext, tag, ...rest] = segments(envelope);
    expect(rest).toEqual([]);
    expect(version).toBe('sb1');
    expect(keyId).toBe('k1');
    expect(Buffer.from(iv ?? '', 'base64url')).toHaveLength(12);
    expect(Buffer.from(tag ?? '', 'base64url')).toHaveLength(16);
    expect(Buffer.from(ciphertext ?? '', 'base64url')).toHaveLength(Buffer.byteLength(PLAINTEXT));
    expect(envelope).toMatch(/^sb1\.k1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{22}$/);
  });

  it('is authenticated with the AAD sb1|<keyId>|<context>, checked with an independent node:crypto decryption', () => {
    const envelope = newBox().encrypt(PLAINTEXT, CONTEXT);
    const [, , iv, ciphertext, tag] = segments(envelope);
    const open = (aad: string): string => {
      const decipher = createDecipheriv('aes-256-gcm', KEY_A, Buffer.from(iv ?? '', 'base64url'), {
        authTagLength: 16,
      });
      decipher.setAAD(Buffer.from(aad));
      decipher.setAuthTag(Buffer.from(tag ?? '', 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(ciphertext ?? '', 'base64url')),
        decipher.final(),
      ]).toString();
    };
    expect(open(`sb1|k1|${CONTEXT}`)).toBe(PLAINTEXT);
    expect(() => open(`sb1|k1|${CONTEXT}x`)).toThrow();
    expect(() => open(`sb1|k2|${CONTEXT}`)).toThrow();
  });

  it('cannot confuse (keyId, context) pairs: a pipe in the context never reaches the key id position', () => {
    // Key ids cannot contain a pipe (rejected above), so the first two pipes of the AAD always
    // delimit the version and the key id, and everything after them is the context.
    const box = new AesGcmSecretBox(keyring({ k1: KEY_A, k1x: KEY_A }, 'k1'));
    const envelope = box.encrypt(PLAINTEXT, 'x|y');
    expect(box.decrypt(envelope, 'x|y')).toBe(PLAINTEXT);
    expect(codeOf(() => box.decrypt(envelope, 'x'))).toBe('DECRYPT_FAILED');
    expect(codeOf(() => box.decrypt(envelope, 'y'))).toBe('DECRYPT_FAILED');
    expect(codeOf(() => box.decrypt(replaceSegment(envelope, 1, 'k1x'), 'x|y'))).toBe(
      'DECRYPT_FAILED',
    );
    expect(codeOf(() => box.decrypt(replaceSegment(envelope, 1, 'k1x'), 'y'))).toBe(
      'DECRYPT_FAILED',
    );
  });

  it('encrypts with the active key id and still opens envelopes made under an older key id', () => {
    const both = { k1: KEY_A, k2: KEY_B };
    const oldEnvelope = new AesGcmSecretBox(keyring(both, 'k1')).encrypt(PLAINTEXT, CONTEXT);
    const rotated = new AesGcmSecretBox(keyring(both, 'k2'));
    const newEnvelope = rotated.encrypt(PLAINTEXT, CONTEXT);
    expect(segments(oldEnvelope)[1]).toBe('k1');
    expect(segments(newEnvelope)[1]).toBe('k2');
    expect(rotated.decrypt(oldEnvelope, CONTEXT)).toBe(PLAINTEXT);
    expect(rotated.decrypt(newEnvelope, CONTEXT)).toBe(PLAINTEXT);
  });
});

describe('AesGcmSecretBox: tamper and wrong key', () => {
  const box = newBox();
  const envelope = box.encrypt(PLAINTEXT, CONTEXT);
  const part = (index: number): string => segments(envelope)[index] ?? '';

  it('opens the untouched envelope, so every failure below is caused by its own change', () => {
    expect(box.decrypt(envelope, CONTEXT)).toBe(PLAINTEXT);
  });

  it.each([
    ['a flipped bit in the IV', replaceSegment(envelope, 2, flipBit(part(2)))],
    ['a flipped bit in the ciphertext', replaceSegment(envelope, 3, flipBit(part(3)))],
    ['a flipped bit in the tag', replaceSegment(envelope, 4, flipBit(part(4)))],
    ['a ciphertext truncated by one byte', replaceSegment(envelope, 3, truncateBytes(part(3), 30))],
    ['an empty ciphertext', replaceSegment(envelope, 3, '')],
    ['a key id that is not in the keyring', replaceSegment(envelope, 1, 'k2')],
  ])('rejects %s with DECRYPT_FAILED', (_name, tampered) => {
    expect(codeOf(() => box.decrypt(tampered, CONTEXT))).toBe('DECRYPT_FAILED');
  });

  it('rejects a key id swapped to another id that holds the same key bytes (id is authenticated)', () => {
    const sameBytes = new AesGcmSecretBox(keyring({ k1: KEY_A, k2: KEY_A }, 'k1'));
    const original = sameBytes.encrypt(PLAINTEXT, CONTEXT);
    expect(sameBytes.decrypt(original, CONTEXT)).toBe(PLAINTEXT);
    expect(codeOf(() => sameBytes.decrypt(replaceSegment(original, 1, 'k2'), CONTEXT))).toBe(
      'DECRYPT_FAILED',
    );
  });

  it('rejects a changed context (context is authenticated)', () => {
    expect(codeOf(() => box.decrypt(envelope, 'store:2:accessToken'))).toBe('DECRYPT_FAILED');
    expect(codeOf(() => box.decrypt(envelope, `${CONTEXT}x`))).toBe('DECRYPT_FAILED');
    expect(codeOf(() => box.decrypt(envelope, CONTEXT.slice(0, -1)))).toBe('DECRYPT_FAILED');
  });

  it('rejects a different valid key with the same generic code', () => {
    expect(codeOf(() => newBox(KEY_B).decrypt(envelope, CONTEXT))).toBe('DECRYPT_FAILED');
    expect(codeOf(() => newBox(randomBytes(32)).decrypt(envelope, CONTEXT))).toBe('DECRYPT_FAILED');
  });

  it.each([
    ['an unknown version marker', envelope.replace(/^sb1/, 'sb2')],
    ['an upper-case version marker', envelope.replace(/^sb1/, 'SB1')],
    ['an empty version marker', envelope.replace(/^sb1/, '')],
    ['a missing tag segment', segments(envelope).slice(0, 4).join('.')],
    [
      'a missing IV and ciphertext',
      segments(envelope)
        .filter((_s, i) => i !== 2 && i !== 3)
        .join('.'),
    ],
    ['an extra segment', `${envelope}.AAAA`],
    ['a trailing dot', `${envelope}.`],
    ['an empty key id', replaceSegment(envelope, 1, '')],
    ['an empty IV', replaceSegment(envelope, 2, '')],
    ['an empty tag', replaceSegment(envelope, 4, '')],
    ['an IV truncated to 11 bytes', replaceSegment(envelope, 2, truncateBytes(part(2), 11))],
    [
      'an IV extended to 13 bytes',
      replaceSegment(envelope, 2, Buffer.alloc(13, 1).toString('base64url')),
    ],
    ['a tag truncated to 15 bytes', replaceSegment(envelope, 4, truncateBytes(part(4), 15))],
    ['a tag truncated to 4 bytes', replaceSegment(envelope, 4, truncateBytes(part(4), 4))],
    [
      'a tag extended to 17 bytes',
      replaceSegment(envelope, 4, Buffer.alloc(17, 1).toString('base64url')),
    ],
    ['the IV and tag segments swapped', swapSegments(envelope, 2, 4)],
    ['the IV and ciphertext segments swapped', swapSegments(envelope, 2, 3)],
    ['the key id and IV segments swapped', swapSegments(envelope, 1, 2)],
    ['padding in the IV', replaceSegment(envelope, 2, `${part(2)}=`)],
    ['standard base64 characters in the ciphertext', replaceSegment(envelope, 3, '++//++//')],
    ['whitespace in the tag', replaceSegment(envelope, 4, ` ${part(4)}`)],
    ['a newline in the ciphertext', replaceSegment(envelope, 3, `${part(3)}\n`)],
    ['non-ASCII characters in the IV', replaceSegment(envelope, 2, 'ñ'.repeat(16))],
    ['a NUL character in the key id', replaceSegment(envelope, 1, 'k\u00001')],
    ['an empty string', ''],
    ['plain text', 'not an envelope'],
    ['only the version marker', 'sb1'],
    ['dots only', '....'],
  ])('rejects %s with MALFORMED_ENVELOPE', (_name, tampered) => {
    expect(codeOf(() => box.decrypt(tampered, CONTEXT))).toBe('MALFORMED_ENVELOPE');
  });

  it('rejects a non-canonical tag encoding that decodes to the same bytes', () => {
    const tag = part(4);
    // A 16-byte tag is 22 characters whose last character carries 4 unused bits; setting one of
    // them decodes to identical bytes but is not the canonical string.
    const last = tag.at(-1) ?? 'A';
    const variant = `${tag.slice(0, -1)}${ALPHABET[ALPHABET.indexOf(last) | 1]}`;
    expect(variant).not.toBe(tag);
    expect(Buffer.from(variant, 'base64url').equals(Buffer.from(tag, 'base64url'))).toBe(true);
    expect(codeOf(() => box.decrypt(replaceSegment(envelope, 4, variant), CONTEXT))).toBe(
      'MALFORMED_ENVELOPE',
    );
  });

  it('rejects an envelope above the size bound before parsing it', () => {
    expect(codeOf(() => box.decrypt(`sb1.k1.${'A'.repeat(MAX_ENVELOPE_LENGTH)}`, CONTEXT))).toBe(
      'MALFORMED_ENVELOPE',
    );
  });

  it.each([null, undefined, 42, {}, ['sb1'], Buffer.from(envelope)])(
    'rejects a non-string envelope (%#)',
    (value) => {
      expect(codeOf(() => box.decrypt(value as string, CONTEXT))).toBe('MALFORMED_ENVELOPE');
    },
  );
});

describe('AesGcmSecretBox: error hygiene', () => {
  const seededKey = randomBytes(32);
  const seededPlaintext = 'seeded-plaintext-must-never-leak-7731';
  const box = new AesGcmSecretBox(keyring({ k1: seededKey }));
  const envelope = box.encrypt(seededPlaintext, CONTEXT);

  function capture(action: () => unknown): SecretBoxError {
    try {
      action();
    } catch (error) {
      if (error instanceof SecretBoxError) return error;
    }
    throw new Error('expected a SecretBoxError');
  }

  const failures: Array<[string, () => unknown]> = [
    [
      'tampered ciphertext',
      () => box.decrypt(replaceSegment(envelope, 3, flipBit(segments(envelope)[3] ?? '')), CONTEXT),
    ],
    ['wrong context', () => box.decrypt(envelope, 'other')],
    ['wrong key', () => new AesGcmSecretBox(keyring({ k1: KEY_B })).decrypt(envelope, CONTEXT)],
    ['malformed envelope', () => box.decrypt(`${envelope}.extra`, CONTEXT)],
    ['invalid plaintext', () => box.encrypt(`${seededPlaintext}\ud800`, CONTEXT)],
    ['invalid key length', () => new AesGcmSecretBox(keyring({ k1: seededKey.subarray(0, 31) }))],
  ];

  it.each(failures)(
    'keeps the key, plaintext and envelope out of the %s error',
    (_name, action) => {
      const error = capture(action);
      const dump = [
        error.message,
        error.stack ?? '',
        String(error),
        error.toString(),
        JSON.stringify(error, Object.getOwnPropertyNames(error)),
      ].join('\n');
      expect(error.cause).toBeUndefined();
      for (const secret of [
        seededPlaintext,
        envelope,
        seededKey.toString('hex'),
        seededKey.toString('base64'),
        seededKey.toString('base64url'),
        seededKey.subarray(0, 31).toString('base64'),
        segments(envelope)[3] ?? '',
        segments(envelope)[4] ?? '',
      ]) {
        expect(dump).not.toContain(secret);
      }
    },
  );

  it('gives a wrong key and tampered data the same code and message', () => {
    const tampered = capture(() =>
      box.decrypt(replaceSegment(envelope, 4, flipBit(segments(envelope)[4] ?? '')), CONTEXT),
    );
    const wrongKey = capture(() =>
      new AesGcmSecretBox(keyring({ k1: KEY_B })).decrypt(envelope, CONTEXT),
    );
    expect(tampered.code).toBe('DECRYPT_FAILED');
    expect(wrongKey.code).toBe('DECRYPT_FAILED');
    expect(tampered.message).toBe(wrongKey.message);
  });
});
