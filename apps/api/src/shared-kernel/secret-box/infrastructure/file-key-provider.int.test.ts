import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FileKeyProvider,
  KeyFileError,
  defaultKeyFilePath,
  type FileKeyProviderOptions,
  type KeyFileErrorCode,
} from './file-key-provider.js';

// Every path below lives inside a temp directory created by the test. The default key location
// under the real home directory is never computed from the real home and never touched.
// Every key is synthetic. Assertions compare lengths, flags and digests so a failure message
// never prints key bytes.
const KEY_1 = Buffer.alloc(32, 0x41);
const KEY_2 = Buffer.alloc(32, 0x42);
const SYMBOL_KEY = Buffer.alloc(32, 0xfb); // standard base64 holds '+' and '/', base64url '-' and '_'
const b64 = (key: Buffer): string => key.toString('base64');
const sameBytes = (a: Uint8Array | undefined, b: Uint8Array | undefined): boolean =>
  a !== undefined && b !== undefined && Buffer.from(a).equals(b);
const KEY_1_PREFIX = b64(KEY_1).slice(0, 16);
const line = (id: string, key: Buffer): string => `${id}:${b64(key)}`;
const VALID = `${line('k1', KEY_1)}\n`;
// Valid lines only, sized so the file is exactly 4097 bytes: one over the 4096-byte limit.
const JUST_OVER_THE_LIMIT = `${[
  ...Array.from({ length: 60 }, (_, index) =>
    line(String(index).padStart(2, '0').padEnd(21, 'x'), KEY_1),
  ),
  line('z'.repeat(31), KEY_1),
].join('\n')}\n`;

const posixOnly = process.platform === 'win32' ? describe.skip : describe;

let root: string;
let previousUmask: number;

beforeEach(() => {
  previousUmask = process.umask(0o022);
  root = mkdtempSync(join(tmpdir(), 'file-key-provider-test-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  process.umask(previousUmask);
});

const keyDir = (): string => join(root, 'keys');
const keyPath = (): string => join(keyDir(), 'secret.key');
const modeOf = (path: string): number => lstatSync(path).mode & 0o777;
const digestOf = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');

function plant(content: string | Buffer, fileMode = 0o600, dirMode = 0o700): void {
  mkdirSync(keyDir(), { recursive: true });
  chmodSync(keyDir(), dirMode);
  writeFileSync(keyPath(), content);
  chmodSync(keyPath(), fileMode);
}

function newProvider(options: Partial<FileKeyProviderOptions> = {}): FileKeyProvider {
  return new FileKeyProvider({ keyFilePath: keyPath(), ...options });
}

function failureOf(action: () => unknown): KeyFileError {
  try {
    action();
  } catch (error) {
    if (error instanceof KeyFileError) return error;
    throw error;
  }
  throw new Error('expected the action to throw a KeyFileError');
}

/** The error must name the path and must not carry any part of the key. */
function expectCode(error: KeyFileError, code: KeyFileErrorCode): void {
  expect(error.code).toBe(code);
  expect(error.message.includes(keyPath())).toBe(true);
  expect(error.message.includes(KEY_1_PREFIX)).toBe(false);
  expect(error.cause).toBeUndefined();
}

describe('FileKeyProvider.generate', () => {
  it('creates the directory 0700 and the file 0600 and returns the key it wrote', () => {
    const keyring = newProvider().generate();
    expect(keyring.activeKeyId).toBe('k1');
    expect(keyring.keys.size).toBe(1);
    expect(keyring.keys.get('k1')?.length).toBe(32);
    expect(modeOf(keyDir())).toBe(0o700);
    expect(modeOf(keyPath())).toBe(0o600);
    expect(lstatSync(keyPath()).size).toBe(`k1:`.length + 44 + 1);

    const reloaded = newProvider().load();
    expect(sameBytes(reloaded?.keys.get('k1'), keyring.keys.get('k1'))).toBe(true);
  });

  it('draws a fresh random key on every call', () => {
    const first = newProvider().generate().keys.get('k1');
    rmSync(keyDir(), { recursive: true });
    const second = newProvider().generate().keys.get('k1');
    expect([first?.length, second?.length]).toEqual([32, 32]);
    expect(sameBytes(first, second)).toBe(false);
  });

  posixOnly('with a hostile umask', () => {
    it.each([0o000, 0o077, 0o022])('still yields 0700 and 0600 under umask %o', (mask) => {
      process.umask(mask);
      newProvider().generate();
      expect(modeOf(keyDir())).toBe(0o700);
      expect(modeOf(keyPath())).toBe(0o600);
    });

    it('removes the file it created when the umask leaves it unreadable for its owner', () => {
      process.umask(0o477);
      try {
        expectCode(
          failureOf(() => newProvider().generate()),
          'KEY_FILE_UNSAFE',
        );
        expect(existsSync(keyPath())).toBe(false);
      } finally {
        chmodSync(keyDir(), 0o700); // the hostile umask also stripped the directory's read bit
      }
    });
  });

  it('never overwrites an existing key file', () => {
    plant(VALID);
    const before = digestOf(keyPath());
    const error = failureOf(() => newProvider().generate());
    expectCode(error, 'KEY_FILE_EXISTS');
    expect(digestOf(keyPath()) === before).toBe(true);
  });

  it('lets only one of two starts create the file', () => {
    const winner = newProvider().generate().keys.get('k1');
    expectCode(
      failureOf(() => newProvider().generate()),
      'KEY_FILE_EXISTS',
    );
    const stored = newProvider().load()?.keys.get('k1');
    expect(sameBytes(stored, winner)).toBe(true);
  });

  posixOnly('through a dangling symlink', () => {
    it('does not follow it and does not create its target', () => {
      mkdirSync(keyDir(), { mode: 0o700 });
      const target = join(root, 'elsewhere.key');
      symlinkSync(target, keyPath());
      expectCode(
        failureOf(() => newProvider().generate()),
        'KEY_FILE_EXISTS',
      );
      expect(existsSync(target)).toBe(false);
    });

    it('refuses an existing directory that others can enter and creates no file', () => {
      mkdirSync(keyDir());
      chmodSync(keyDir(), 0o755);
      expectCode(
        failureOf(() => newProvider().generate()),
        'KEY_FILE_UNSAFE',
      );
      expect(existsSync(keyPath())).toBe(false);
    });
  });
});

describe('FileKeyProvider.load', () => {
  it('returns null when the file or its directory does not exist, creating nothing', () => {
    expect(newProvider().load()).toBeNull();
    expect(existsSync(keyDir())).toBe(false);
    mkdirSync(keyDir(), { mode: 0o700 });
    expect(newProvider().load()).toBeNull();
    expect(existsSync(keyPath())).toBe(false);
  });

  it.each([
    ['one line with a trailing newline', VALID],
    ['one line without a trailing newline', line('k1', KEY_1)],
  ])('reads %s', (_name, content) => {
    plant(content);
    const keyring = newProvider().load();
    expect(keyring?.activeKeyId).toBe('k1');
    expect(sameBytes(keyring?.keys.get('k1'), KEY_1)).toBe(true);
  });

  it('keeps every key and makes the last line the active one', () => {
    plant(`${line('k1', KEY_1)}\n${line('k2', KEY_2)}\n`);
    const keyring = newProvider().load();
    expect(keyring?.activeKeyId).toBe('k2');
    expect(keyring?.keys.size).toBe(2);
    expect(sameBytes(keyring?.keys.get('k1'), KEY_1)).toBe(true);
    expect(sameBytes(keyring?.keys.get('k2'), KEY_2)).toBe(true);
  });

  it('accepts a key whose standard base64 uses plus and slash', () => {
    plant(`${line('k1', SYMBOL_KEY)}\n`);
    expect(sameBytes(newProvider().load()?.keys.get('k1'), SYMBOL_KEY)).toBe(true);
  });

  const malformed: [string, string | Buffer][] = [
    ['an empty file', ''],
    ['only a newline', '\n'],
    ['a blank line between keys', `${line('k1', KEY_1)}\n\n${line('k2', KEY_2)}\n`],
    ['a second trailing newline', `${line('k1', KEY_1)}\n\n`],
    ['trailing garbage after the key', `${line('k1', KEY_1)}\nextra`],
    ['trailing characters on the key line', `${line('k1', KEY_1)}x\n`],
    ['a missing separator', `k1${b64(KEY_1)}\n`],
    ['an empty key id', `:${b64(KEY_1)}\n`],
    ['a key id with a dot', `k.1:${b64(KEY_1)}\n`],
    ['a key id longer than 32 characters', `${'k'.repeat(33)}:${b64(KEY_1)}\n`],
    ['carriage return line endings', `${line('k1', KEY_1)}\r\n`],
    ['leading whitespace', ` ${line('k1', KEY_1)}\n`],
    ['a byte order mark', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(VALID)])],
    ['a NUL byte', `${line('k1', KEY_1)}\0\n`],
    ['a key of 31 bytes', `k1:${b64(Buffer.alloc(31, 0x41))}\n`],
    ['a key of 33 bytes', `k1:${b64(Buffer.alloc(33, 0x41))}\n`],
    ['a key of 16 bytes', `k1:${b64(Buffer.alloc(16, 0x41))}\n`],
    ['characters outside base64', `k1:${'!'.repeat(43)}=\n`],
    ['base64 without its padding', `k1:${b64(KEY_1).slice(0, 43)}\n`],
    ['non-canonical trailing bits', `k1:${b64(KEY_1).slice(0, 42)}B=\n`],
    ['base64url instead of standard base64', `k1:${SYMBOL_KEY.toString('base64url')}\n`],
    ['a repeated key id', `${line('k1', KEY_1)}\n${line('k1', KEY_2)}\n`],
    ['a file one byte over the limit made only of valid lines', JUST_OVER_THE_LIMIT],
    [
      'a file far larger than the limit made only of valid lines',
      Array.from({ length: 100 }, (_, index) => line(`k${index}`, KEY_1)).join('\n') + '\n',
    ],
  ];

  it.each(malformed)('rejects %s and leaves the file untouched', (_name, content) => {
    plant(content);
    const before = digestOf(keyPath());
    expectCode(
      failureOf(() => newProvider().load()),
      'KEY_FILE_MALFORMED',
    );
    expect(digestOf(keyPath()) === before).toBe(true);
    expect(modeOf(keyPath())).toBe(0o600);
  });

  it('uses a fixture that is exactly one byte over the 4096-byte limit', () => {
    expect(Buffer.byteLength(JUST_OVER_THE_LIMIT)).toBe(4097);
  });

  it('rejects a path that is not absolute', () => {
    const error = failureOf(() => new FileKeyProvider({ keyFilePath: 'relative/secret.key' }));
    expect(error.code).toBe('KEY_FILE_PATH');
    expect(error.message).toContain('relative/secret.key');
  });

  it('computes the default location from the home directory it is given', () => {
    expect(defaultKeyFilePath(root)).toBe(join(root, '.shopify-catalog-importer', 'secret.key'));
  });

  it('reports a parent that is not a directory as an I/O failure without a cause', () => {
    plant(VALID);
    const inner = join(keyPath(), 'inner');
    const error = failureOf(() => newProvider({ keyFilePath: inner }).load());
    expect(error.code).toBe('KEY_FILE_IO');
    expect(error.message).toContain(inner);
    expect(error.cause).toBeUndefined();
  });
});

posixOnly('FileKeyProvider.load permission rules', () => {
  it.each([0o640, 0o604, 0o660, 0o644, 0o666, 0o670])(
    'rejects a key file with mode %o and leaves it untouched',
    (mode) => {
      plant(VALID, mode);
      const before = digestOf(keyPath());
      expectCode(
        failureOf(() => newProvider().load()),
        'KEY_FILE_UNSAFE',
      );
      expect(modeOf(keyPath())).toBe(mode);
      expect(digestOf(keyPath()) === before).toBe(true);
    },
  );

  it.each([0o600, 0o400])('accepts a key file with mode %o', (mode) => {
    plant(VALID, mode);
    expect(newProvider().load()?.activeKeyId).toBe('k1');
  });

  it.each([0o750, 0o755, 0o710, 0o701, 0o770])(
    'rejects a directory with mode %o, even when the file is 0600',
    (mode) => {
      plant(VALID, 0o600, mode);
      expectCode(
        failureOf(() => newProvider().load()),
        'KEY_FILE_UNSAFE',
      );
    },
  );

  it('rejects a loose directory even when the key file does not exist yet', () => {
    mkdirSync(keyDir());
    chmodSync(keyDir(), 0o755);
    expectCode(
      failureOf(() => newProvider().load()),
      'KEY_FILE_UNSAFE',
    );
  });

  it('rejects a symlink to a valid key file', () => {
    plant(VALID);
    const link = join(keyDir(), 'link.key');
    symlinkSync(keyPath(), link);
    const error = failureOf(() => newProvider({ keyFilePath: link }).load());
    expect(error.code).toBe('KEY_FILE_UNSAFE');
    expect(error.message).toContain(link);
  });

  it('rejects something that is not a regular file', () => {
    mkdirSync(keyPath(), { recursive: true, mode: 0o700 });
    chmodSync(keyDir(), 0o700);
    expectCode(
      failureOf(() => newProvider().load()),
      'KEY_FILE_UNSAFE',
    );
  });

  it('rejects a file or directory owned by another user', () => {
    plant(VALID);
    const myUid = process.getuid?.() ?? 0;
    expectCode(
      failureOf(() => newProvider({ getUid: () => myUid + 1 }).load()),
      'KEY_FILE_UNSAFE',
    );
  });
});

describe('FileKeyProvider on a platform without POSIX modes', () => {
  it('skips the mode and owner rules, warns once and names no key material', () => {
    plant(VALID, 0o666, 0o777);
    const warnings: string[] = [];
    const provider = newProvider({ platform: 'win32', warn: (message) => warnings.push(message) });
    expect(provider.load()?.activeKeyId).toBe('k1');
    provider.load();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(keyPath());
    expect(warnings[0]).not.toContain(KEY_1_PREFIX);
  });

  it('does not warn where permissions are enforced', () => {
    plant(VALID);
    const warnings: string[] = [];
    newProvider({ platform: 'linux', warn: (message) => warnings.push(message) }).load();
    expect(warnings).toHaveLength(0);
  });

  it('still validates the content', () => {
    plant('not a key\n');
    expectCode(
      failureOf(() => newProvider({ platform: 'win32', warn: () => undefined }).load()),
      'KEY_FILE_MALFORMED',
    );
  });
});
