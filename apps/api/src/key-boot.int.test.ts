import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isDuplicateKeyError, keyForms, reconcileKey, registerKeyring } from './key-boot.js';
import { databaseFilePath, prepareDatabaseFile } from './persistence/database-location.js';
import { PrismaKeyCheckStore } from './persistence/prisma-key-check-store.js';
import { PrismaService } from './persistence/prisma.service.js';
import { BootError } from './shared-kernel/boot-error.js';
import { clearRegisteredSecretsForTests, redactString } from './shared-kernel/logging/redact.js';
import { FileKeyProvider } from './shared-kernel/secret-box/infrastructure/file-key-provider.js';
import type { KeyCheckStore } from './shared-kernel/secret-box/key-check-store.port.js';
import type { Keyring } from './shared-kernel/secret-box/key-provider.port.js';

let sandbox: string;
let dataDir: string;
let keyFilePath: string;
const services: PrismaService[] = [];

// Every database and key file lives inside one temporary folder that is removed afterwards.
async function connection(): Promise<PrismaKeyCheckStore> {
  const service = new PrismaService({ dataDir, busyTimeoutMs: 2000 });
  await service.connect();
  services.push(service);
  return new PrismaKeyCheckStore(service);
}

beforeEach(async () => {
  clearRegisteredSecretsForTests();
  sandbox = await mkdtemp(join(tmpdir(), 'importer-key-boot-'));
  dataDir = join(sandbox, 'data');
  keyFilePath = join(sandbox, 'keys', 'secret.key');
  prepareDatabaseFile(dataDir);
  const db = new Database(databaseFilePath(dataDir));
  try {
    db.exec(
      readFileSync(
        new URL('../prisma/migrations/20261013180211_baseline/migration.sql', import.meta.url),
        'utf8',
      ),
    );
  } finally {
    db.close();
  }
});

afterEach(async () => {
  await Promise.all(services.splice(0).map((service) => service.disconnect()));
  await rm(sandbox, { recursive: true, force: true });
});

function ringOf(...entries: [string, Uint8Array][]): Keyring {
  return { activeKeyId: entries[entries.length - 1]?.[0] ?? 'k1', keys: new Map(entries) };
}

describe('keyForms and registerKeyring', () => {
  // 0xfb bytes encode to '+' and '/' in base64, so base64 and base64url differ.
  const key = new Uint8Array(32).fill(0xfb);
  const buffer = Buffer.from(key);

  it('lists every textual form the key can take in a log line', () => {
    const forms = keyForms(key);
    expect(forms).toContain(buffer.toString('base64'));
    expect(forms).toContain(buffer.toString('base64').replace(/=+$/, ''));
    expect(forms).toContain(buffer.toString('base64url'));
    expect(forms).toContain(buffer.toString('base64url') + '=');
    expect(forms).toContain(buffer.toString('hex'));
    expect(forms).toContain(buffer.toString('hex').toUpperCase());
    expect(new Set(forms).size).toBe(forms.length);
    expect(buffer.toString('base64')).toMatch(/[+/]/);
    expect(forms.every((form) => form.length >= 8)).toBe(true);
  });

  it('removes every form from any string once the ring is registered', () => {
    const ring = ringOf(['k1', key]);
    const registered = registerKeyring(ring);
    expect(registered).toBe(keyForms(key).length);
    for (const form of keyForms(key)) {
      const line = `before ${form} after`;
      expect(redactString(line)).not.toContain(form);
      expect(redactString(line)).toContain('before');
    }
    const fileLine = `k1:${buffer.toString('base64')}`;
    expect(redactString(fileLine)).not.toContain(buffer.toString('base64'));
  });

  it('registers every key of the ring, not only the active one', () => {
    const older = randomBytes(32);
    const active = randomBytes(32);
    registerKeyring(ringOf(['k1', older], ['k2', active]));
    expect(redactString(older.toString('hex'))).not.toContain(older.toString('hex'));
    expect(redactString(active.toString('base64url'))).not.toContain(active.toString('base64url'));
  });

  it('does not register anything it cannot name: unrelated text passes through', () => {
    registerKeyring(ringOf(['k1', key]));
    expect(redactString('keyId k1 count 3')).toBe('keyId k1 count 3');
  });
});

describe('isDuplicateKeyError', () => {
  it('recognises the error the real insert-only store raises for a duplicate', async () => {
    const store = await connection();
    await store.write('k1', 'sb1.first');
    const error = await store.write('k1', 'sb1.second').then(
      () => undefined,
      (caught: unknown) => caught,
    );
    expect(error).toBeDefined();
    expect(isDuplicateKeyError(error)).toBe(true);
  });

  it.each([{ code: 'P2002', meta: {} }, Object.assign(new Error('x'), { code: 'P2002' })])(
    'accepts the Prisma unique-constraint code on %o',
    (error) => {
      expect(isDuplicateKeyError(error)).toBe(true);
    },
  );

  it.each([
    new Error('x'),
    { code: 'P2025' },
    { code: 2002 },
    { code: 'p2002' },
    'P2002',
    null,
    undefined,
  ])('refuses %o', (error) => {
    expect(isDuplicateKeyError(error)).toBe(false);
  });
});

describe('reconcileKey', () => {
  const provider = (): FileKeyProvider => new FileKeyProvider({ keyFilePath });

  it('generates the key on a first run and stores only its check', async () => {
    const store = await connection();
    const result = await reconcileKey(provider(), store);
    expect(result.outcome).toBe('generated');
    expect(provider().load()?.activeKeyId).toBe('k1');
  });

  // A second start reads "no row yet", the first start then writes it, and the second start's
  // own write hits the primary key. Two independent connections to one database make that real;
  // the stale read is the only simulated part, because the real interleaving is a matter of
  // microseconds.
  function staleFirstRead(real: KeyCheckStore, stale: { reads: number }): KeyCheckStore {
    return {
      read: async (keyId) => {
        const value = await real.read(keyId);
        stale.reads += 1;
        return stale.reads === 1 ? null : value;
      },
      write: (keyId, envelope) => real.write(keyId, envelope),
    };
  }

  it('re-runs once after losing the race and verifies against the winner row', async () => {
    const winnerStore = await connection();
    const loserStore = await connection();
    provider().generate();
    expect((await reconcileKey(provider(), winnerStore)).outcome).toBe('recorded');
    const winnerRow = await winnerStore.read('k1');

    const stale = { reads: 0 };
    const result = await reconcileKey(provider(), staleFirstRead(loserStore, stale));

    expect(result.outcome).toBe('verified');
    expect(stale.reads).toBe(2);
    expect(await winnerStore.read('k1')).toBe(winnerRow);
  });

  it('aborts with a key mismatch when the winner used a different key', async () => {
    const winnerStore = await connection();
    const loserStore = await connection();
    const winnerKeyFile = join(sandbox, 'winner', 'secret.key');
    const winner = new FileKeyProvider({ keyFilePath: winnerKeyFile });
    winner.generate();
    await reconcileKey(winner, winnerStore);
    const winnerRow = await winnerStore.read('k1');
    provider().generate();

    const failure = await reconcileKey(provider(), staleFirstRead(loserStore, { reads: 0 })).then(
      () => undefined,
      (caught: unknown) => caught,
    );

    expect(failure).toBeInstanceOf(BootError);
    expect(failure).toMatchObject({ code: 'KEY_MISMATCH' });
    expect(await winnerStore.read('k1')).toBe(winnerRow);
  });

  it('aborts with a typed error when the second attempt loses the race as well', async () => {
    const winnerStore = await connection();
    const loserStore = await connection();
    provider().generate();
    await reconcileKey(provider(), winnerStore);
    const winnerRow = await winnerStore.read('k1');
    const alwaysStale: KeyCheckStore = {
      read: () => Promise.resolve(null),
      write: (keyId, envelope) => loserStore.write(keyId, envelope),
    };

    const failure = await reconcileKey(provider(), alwaysStale).then(
      () => undefined,
      (caught: unknown) => caught,
    );

    expect(failure).toBeInstanceOf(BootError);
    expect(failure).toMatchObject({ code: 'KEY_CHECK_CONFLICT' });
    expect(await winnerStore.read('k1')).toBe(winnerRow);
  });

  it('does not retry any other store failure', async () => {
    provider().generate();
    let writes = 0;
    const failing: KeyCheckStore = {
      read: () => Promise.resolve(null),
      write: () => {
        writes += 1;
        return Promise.reject(new Error('disk full'));
      },
    };
    await expect(reconcileKey(provider(), failing)).rejects.toThrow('disk full');
    expect(writes).toBe(1);
  });

  it('leaves a malformed key file untouched and reports it as a boot error', async () => {
    const store = await connection();
    provider().generate();
    writeFileSync(keyFilePath, 'not a key\n', { mode: 0o600 });
    const before = readFileSync(keyFilePath);
    const failure = await reconcileKey(provider(), store).then(
      () => undefined,
      (caught: unknown) => caught,
    );
    expect(failure).toMatchObject({ code: 'KEY_FILE_INVALID' });
    expect(readFileSync(keyFilePath)).toEqual(before);
  });
});
