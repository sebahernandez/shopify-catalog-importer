import { createHash, randomBytes } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BootError, type BootErrorCode } from '../boot-error.js';
import { FileKeyProvider, KeyFileError } from './infrastructure/file-key-provider.js';
import { AesGcmSecretBox } from './infrastructure/aes-gcm-secret-box.js';
import type { KeyCheckStore } from './key-check-store.port.js';
import type { KeyProvider, Keyring } from './key-provider.port.js';
import {
  KEY_CHECK_CONTEXT,
  KEY_CHECK_PLAINTEXT,
  SecretKeyBootstrap,
} from './secret-key-bootstrap.js';

// Every path lives in a temp directory created by the test; the real home directory is never
// involved. Keys are synthetic or random and are only compared through flags and digests.
class MemoryKeyCheckStore implements KeyCheckStore {
  readonly rows = new Map<string, string>();
  readonly writes: string[] = [];

  read(keyId: string): Promise<string | null> {
    return Promise.resolve(this.rows.get(keyId) ?? null);
  }

  write(keyId: string, envelope: string): Promise<void> {
    this.writes.push(keyId);
    this.rows.set(keyId, envelope);
    return Promise.resolve();
  }
}

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'secret-key-bootstrap-test-'));
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

const keyDir = (): string => join(root, 'keys');
const keyPath = (): string => join(keyDir(), 'secret.key');
const provider = (): FileKeyProvider => new FileKeyProvider({ keyFilePath: keyPath() });
const digestOf = (path: string): string =>
  createHash('sha256').update(readFileSync(path)).digest('hex');
const boxFor = (key: Uint8Array, keyId = 'k1'): AesGcmSecretBox =>
  new AesGcmSecretBox({ activeKeyId: keyId, keys: new Map([[keyId, key]]) });
const keyOf = (keyring: Keyring | null): Uint8Array => keyring?.keys.get('k1') ?? new Uint8Array();

async function failureOf(action: Promise<unknown>): Promise<BootError> {
  try {
    await action;
  } catch (error) {
    if (error instanceof BootError) return error;
    throw error;
  }
  throw new Error('expected a BootError');
}

function expectBootError(error: BootError, code: BootErrorCode): void {
  expect(error.code).toBe(code);
  expect(error.cause).toBeUndefined();
}

/** Plants a valid key file through the provider and returns its key. */
function plantKey(): Uint8Array {
  return keyOf(provider().generate());
}

describe('SecretKeyBootstrap, D4 table', () => {
  it('row 1: no key file and no row generates a key and writes the row', async () => {
    const store = new MemoryKeyCheckStore();
    const result = await new SecretKeyBootstrap(provider(), store).run();

    expect(result.outcome).toBe('generated');
    expect(result.keyring.activeKeyId).toBe('k1');
    expect(lstatSync(keyPath()).mode & 0o777).toBe(0o600);
    expect(keyOf(provider().load()).length).toBe(32);
    expect(Buffer.from(keyOf(provider().load())).equals(keyOf(result.keyring))).toBe(true);
    expect(store.writes).toEqual(['k1']);
  });

  it('row 1: the stored row is an encryption of the constant that hides the key', async () => {
    const store = new MemoryKeyCheckStore();
    const { keyring } = await new SecretKeyBootstrap(provider(), store).run();
    const key = Buffer.from(keyOf(keyring));
    const row = store.rows.get('k1') ?? '';

    expect(row.startsWith('sb1.k1.')).toBe(true);
    expect(boxFor(key).decrypt(row, KEY_CHECK_CONTEXT)).toBe(KEY_CHECK_PLAINTEXT);
    expect(() => boxFor(key).decrypt(row, 'another-context')).toThrow();
    for (const form of [key.toString('base64'), key.toString('base64url'), key.toString('hex')]) {
      expect(row.includes(form)).toBe(false);
    }
    expect(JSON.stringify([...store.rows])).not.toContain(KEY_CHECK_PLAINTEXT);
  });

  it('row 2: a key file and no row writes only the row and leaves the file alone', async () => {
    const key = plantKey();
    const before = digestOf(keyPath());
    const store = new MemoryKeyCheckStore();
    const result = await new SecretKeyBootstrap(provider(), store).run();

    expect(result.outcome).toBe('recorded');
    expect(digestOf(keyPath()) === before).toBe(true);
    expect(store.writes).toEqual(['k1']);
    expect(boxFor(key).decrypt(store.rows.get('k1') ?? '', KEY_CHECK_CONTEXT)).toBe(
      KEY_CHECK_PLAINTEXT,
    );
  });

  it('row 3: a key file and a matching row verifies and writes nothing', async () => {
    const store = new MemoryKeyCheckStore();
    await new SecretKeyBootstrap(provider(), store).run();
    const row = store.rows.get('k1');
    const before = digestOf(keyPath());

    const result = await new SecretKeyBootstrap(provider(), store).run();
    expect(result.outcome).toBe('verified');
    expect(store.writes).toEqual(['k1']);
    expect(store.rows.get('k1')).toBe(row);
    expect(digestOf(keyPath()) === before).toBe(true);
  });

  describe('row 4: a row that the key does not open', () => {
    const wrongRows: [string, (key: Uint8Array) => string][] = [
      [
        'an envelope made under another key',
        () => boxFor(randomBytes(32)).encrypt(KEY_CHECK_PLAINTEXT, KEY_CHECK_CONTEXT),
      ],
      [
        'a different constant under the right key',
        (key) => boxFor(key).encrypt('another constant', KEY_CHECK_CONTEXT),
      ],
      [
        'the constant under the wrong context',
        (key) => boxFor(key).encrypt(KEY_CHECK_PLAINTEXT, 'other-context'),
      ],
      ['text that is not an envelope', () => 'not-an-envelope'],
      ['an empty value', () => ''],
    ];

    it.each(wrongRows)('fails on %s, keeping the row and the key file', async (_name, makeRow) => {
      const key = plantKey();
      const keyFileBefore = digestOf(keyPath());
      const store = new MemoryKeyCheckStore();
      const row = makeRow(key);
      store.rows.set('k1', row);

      const error = await failureOf(new SecretKeyBootstrap(provider(), store).run());
      expectBootError(error, 'KEY_MISMATCH');
      expect(error.message).toContain('does not match');
      expect(error.message.includes(Buffer.from(key).toString('base64'))).toBe(false);
      expect(store.rows.get('k1')).toBe(row);
      expect(store.writes).toEqual([]);
      expect(digestOf(keyPath()) === keyFileBefore).toBe(true);
    });
  });

  describe('row 5: no key file but a row exists', () => {
    it('fails and never regenerates, creating neither file nor directory', async () => {
      const store = new MemoryKeyCheckStore();
      store.rows.set('k1', boxFor(randomBytes(32)).encrypt(KEY_CHECK_PLAINTEXT, KEY_CHECK_CONTEXT));

      const error = await failureOf(new SecretKeyBootstrap(provider(), store).run());
      expectBootError(error, 'KEY_FILE_REQUIRED');
      expect(error.message).toContain('SECRET_KEY_FILE');
      expect(existsSync(keyDir())).toBe(false);
      expect(store.writes).toEqual([]);
    });

    it('also creates no file when its directory already exists', async () => {
      mkdirSync(keyDir(), { mode: 0o700 });
      const store = new MemoryKeyCheckStore();
      store.rows.set('k1', 'sb1.k1.any.thing.here');

      expectBootError(
        await failureOf(new SecretKeyBootstrap(provider(), store).run()),
        'KEY_FILE_REQUIRED',
      );
      expect(existsSync(keyPath())).toBe(false);
    });

    it('does not generate when the store cannot be read', async () => {
      const store = new MemoryKeyCheckStore();
      vi.spyOn(store, 'read').mockRejectedValue(new Error('database unavailable'));

      await expect(new SecretKeyBootstrap(provider(), store).run()).rejects.toThrow(
        'database unavailable',
      );
      expect(existsSync(keyDir())).toBe(false);
    });
  });

  describe('row 6: an unusable key file, whatever the row holds', () => {
    const unusable: [string, () => void][] = [
      [
        'malformed',
        () => {
          mkdirSync(keyDir(), { mode: 0o700 });
          writeFileSync(keyPath(), 'k1:short\n', { mode: 0o600 });
        },
      ],
      [
        'duplicate id',
        () => {
          const key = Buffer.alloc(32, 1).toString('base64');
          mkdirSync(keyDir(), { mode: 0o700 });
          writeFileSync(keyPath(), `k1:${key}\nk1:${key}\n`, { mode: 0o600 });
        },
      ],
      [
        'too permissive',
        () => {
          plantKey();
          chmodSync(keyPath(), 0o644);
        },
      ],
    ];

    it.each(unusable)('fails on a %s file and leaves it untouched', async (name, plant) => {
      if (name === 'too permissive' && process.platform === 'win32') return;
      for (const rowPresent of [false, true]) {
        rmSync(keyDir(), { recursive: true, force: true });
        plant();
        const before = digestOf(keyPath());
        const store = new MemoryKeyCheckStore();
        if (rowPresent) store.rows.set('k1', 'sb1.k1.any.thing.here');

        const error = await failureOf(new SecretKeyBootstrap(provider(), store).run());
        expectBootError(error, 'KEY_FILE_INVALID');
        expect(error.message.includes(keyPath())).toBe(true);
        expect(store.writes).toEqual([]);
        expect(digestOf(keyPath()) === before).toBe(true);
      }
    });

    it('fails when another start creates the file between the check and the create', async () => {
      const racing: KeyProvider = {
        load: () => null,
        generate: () => {
          throw new KeyFileError(
            'KEY_FILE_EXISTS',
            keyPath(),
            'it already exists and is not overwritten.',
          );
        },
      };
      const store = new MemoryKeyCheckStore();
      expectBootError(
        await failureOf(new SecretKeyBootstrap(racing, store).run()),
        'KEY_FILE_INVALID',
      );
      expect(store.writes).toEqual([]);
    });
  });

  it('recovers when the row write fails after the key was generated', async () => {
    const store = new MemoryKeyCheckStore();
    vi.spyOn(store, 'write').mockRejectedValueOnce(new Error('disk full'));
    await expect(new SecretKeyBootstrap(provider(), store).run()).rejects.toThrow('disk full');
    expect(existsSync(keyPath())).toBe(true);

    expect((await new SecretKeyBootstrap(provider(), store).run()).outcome).toBe('recorded');
  });

  it('neither exits the process nor writes to the console', async () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const sinks = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    );
    const store = new MemoryKeyCheckStore();
    await new SecretKeyBootstrap(provider(), store).run();
    store.rows.set('k1', 'garbage');
    await failureOf(new SecretKeyBootstrap(provider(), store).run());

    expect(exit).not.toHaveBeenCalled();
    expect(sinks.map((sink) => sink.mock.calls.length)).toEqual([0, 0, 0, 0, 0]);
  });
});
