import { describe, expect, it, vi } from 'vitest';
import { AesGcmSecretBox } from './infrastructure/aes-gcm-secret-box.js';
import { DeferredSecretBox } from './deferred-secret-box.js';
import { SecretBoxError } from './secret-box-error.js';
import type { SecretBox } from './secret-box.port.js';

const keyring = { activeKeyId: 'k1', keys: new Map([['k1', Buffer.alloc(32, 0x33)]]) };
const PLAINTEXT = 'synthetic-credential-value-0002';
const CONTEXT = 'store:1:credentials';

function codeOf(action: () => unknown): unknown {
  try {
    action();
  } catch (error) {
    return error instanceof SecretBoxError ? error.code : 'UNTYPED_ERROR';
  }
  return 'NO_ERROR';
}

describe('DeferredSecretBox', () => {
  it('fails with KEY_MISSING before bind and leaks nothing in the message', () => {
    const box = new DeferredSecretBox();
    expect(codeOf(() => box.encrypt(PLAINTEXT, CONTEXT))).toBe('KEY_MISSING');
    expect(codeOf(() => box.decrypt('sb1.x.y.z', CONTEXT))).toBe('KEY_MISSING');
    try {
      box.encrypt(PLAINTEXT, CONTEXT);
    } catch (error) {
      expect((error as Error).message).not.toContain(PLAINTEXT);
      expect((error as Error).message).not.toContain(CONTEXT);
    }
  });

  it('round trips after bind and rejects a wrong context with DECRYPT_FAILED', () => {
    const box = new DeferredSecretBox();
    box.bind(new AesGcmSecretBox(keyring));
    const envelope = box.encrypt(PLAINTEXT, CONTEXT);
    expect(box.decrypt(envelope, CONTEXT)).toBe(PLAINTEXT);
    expect(codeOf(() => box.decrypt(envelope, 'store:2:credentials'))).toBe('DECRYPT_FAILED');
  });

  it('refuses a second bind and keeps the first delegate', () => {
    const box = new DeferredSecretBox();
    const first = new AesGcmSecretBox(keyring);
    box.bind(first);
    expect(() => box.bind(new AesGcmSecretBox(keyring))).toThrow(SecretBoxError);
    expect(box.decrypt(first.encrypt(PLAINTEXT, CONTEXT), CONTEXT)).toBe(PLAINTEXT);
  });

  it('resolves the delegate at call time, not at construction or bind', () => {
    const box = new DeferredSecretBox();
    const encrypt = vi.fn(() => 'one');
    const delegate: SecretBox = { encrypt, decrypt: vi.fn(() => 'two') };
    const holder = { box };
    box.bind(delegate);
    expect(holder.box.encrypt('a', 'c')).toBe('one');
    expect(holder.box.decrypt('e', 'c')).toBe('two');
    expect(encrypt).toHaveBeenCalledWith('a', 'c');
  });
});
