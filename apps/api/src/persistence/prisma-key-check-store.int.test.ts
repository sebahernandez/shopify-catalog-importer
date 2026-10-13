import 'reflect-metadata';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ConfigModule } from '../config/config.module.js';
import { AesGcmSecretBox } from '../shared-kernel/secret-box/infrastructure/aes-gcm-secret-box.js';
import { FileKeyProvider } from '../shared-kernel/secret-box/infrastructure/file-key-provider.js';
import {
  KEY_CHECK_CONTEXT,
  KEY_CHECK_PLAINTEXT,
  SecretKeyBootstrap,
} from '../shared-kernel/secret-box/secret-key-bootstrap.js';
import { databaseFilePath, prepareDatabaseFile } from './database-location.js';
import { KEY_CHECK_STORE, PersistenceModule, PRISMA_SERVICE } from './persistence.module.js';
import { PrismaKeyCheckStore } from './prisma-key-check-store.js';
import { PrismaService } from './prisma.service.js';

let sandbox: string;
let dataDir: string;
let keyFilePath: string;
let service: PrismaService;
let store: PrismaKeyCheckStore;
let provider: FileKeyProvider;

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), 'importer-key-check-'));
  dataDir = join(sandbox, 'data');
  keyFilePath = join(sandbox, 'keys', 'secret.key');
  prepareDatabaseFile(dataDir);
  const db = new Database(databaseFilePath(dataDir));
  try {
    db.exec(
      readFileSync(
        new URL('../../prisma/migrations/20261013180211_baseline/migration.sql', import.meta.url),
        'utf8',
      ),
    );
  } finally {
    db.close();
  }
  service = new PrismaService({ dataDir, busyTimeoutMs: 1234 });
  await service.connect();
  store = new PrismaKeyCheckStore(service);
  provider = new FileKeyProvider({ keyFilePath });
});

afterEach(async () => {
  await service?.disconnect();
  await rm(sandbox, { recursive: true, force: true });
});

// A typed view keeps assertions independent of the generated client's unchecked internals.
async function rows(): Promise<{ key: string; value: string; updatedAt: Date }[]> {
  return service.client.appSetting.findMany({ orderBy: { key: 'asc' } });
}

describe('SecretKeyBootstrap with PrismaKeyCheckStore', () => {
  it('generates an absent key and persists only its encrypted public check', async () => {
    expect(await rows()).toEqual([]);
    expect(existsSync(keyFilePath)).toBe(false);

    const result = await new SecretKeyBootstrap(provider, store).run();

    expect(result.outcome).toBe('generated');
    expect(provider.load()?.activeKeyId).toBe('k1');
    const envelope = await store.read('k1');
    expect(envelope).toMatch(/^sb1\.k1\./);
    expect(envelope).not.toContain(KEY_CHECK_PLAINTEXT);
    expect(envelope).not.toContain(readFileSync(keyFilePath, 'utf8').split(':')[1]?.trim());
    const box = new AesGcmSecretBox(result.keyring);
    expect(box.decrypt(envelope ?? '', KEY_CHECK_CONTEXT)).toBe(KEY_CHECK_PLAINTEXT);
    const persisted = await rows();
    expect(persisted.map(({ key, value }) => ({ key, value }))).toEqual([
      { key: 'secret-key-check:k1', value: envelope },
    ]);
    expect(persisted[0]?.updatedAt).toBeInstanceOf(Date);
  });

  it('records a present key without changing its file', async () => {
    provider.generate();
    const original = readFileSync(keyFilePath);

    const result = await new SecretKeyBootstrap(provider, store).run();

    expect(result.outcome).toBe('recorded');
    expect(readFileSync(keyFilePath)).toEqual(original);
    expect(await rows()).toHaveLength(1);
    expect(
      new AesGcmSecretBox(result.keyring).decrypt(
        (await store.read('k1')) ?? '',
        KEY_CHECK_CONTEXT,
      ),
    ).toBe(KEY_CHECK_PLAINTEXT);
  });

  it('verifies a matching key after reopening the database without changing the row', async () => {
    await new SecretKeyBootstrap(provider, store).run();
    const original = await rows();
    const keyFile = readFileSync(keyFilePath);
    await service.disconnect();
    await service.connect();

    const result = await new SecretKeyBootstrap(new FileKeyProvider({ keyFilePath }), store).run();

    expect(result.outcome).toBe('verified');
    expect(await rows()).toEqual(original);
    expect(readFileSync(keyFilePath)).toEqual(keyFile);
  });

  it('rejects a different key and leaves the stored envelope and key file untouched', async () => {
    await new SecretKeyBootstrap(provider, store).run();
    const original = await rows();
    unlinkSync(keyFilePath);
    provider.generate();
    const replacement = readFileSync(keyFilePath);

    await expect(new SecretKeyBootstrap(provider, store).run()).rejects.toMatchObject({
      code: 'KEY_MISMATCH',
    });

    expect(await rows()).toEqual(original);
    expect(readFileSync(keyFilePath)).toEqual(replacement);
  });

  it('refuses to regenerate a lost key when its check is already stored', async () => {
    await new SecretKeyBootstrap(provider, store).run();
    const original = await rows();
    unlinkSync(keyFilePath);

    await expect(new SecretKeyBootstrap(provider, store).run()).rejects.toMatchObject({
      code: 'KEY_FILE_REQUIRED',
    });

    expect(existsSync(keyFilePath)).toBe(false);
    expect(await rows()).toEqual(original);
  });

  it('rejects a malformed key file without changing either persisted artifact', async () => {
    await new SecretKeyBootstrap(provider, store).run();
    const original = await rows();
    writeFileSync(keyFilePath, 'invalid key file\n');

    await expect(new SecretKeyBootstrap(provider, store).run()).rejects.toMatchObject({
      code: 'KEY_FILE_INVALID',
    });

    expect(readFileSync(keyFilePath, 'utf8')).toBe('invalid key file\n');
    expect(await rows()).toEqual(original);
  });
});

describe('PrismaKeyCheckStore', () => {
  it('returns null for absent ids and keeps each check separate from other settings', async () => {
    expect(await store.read('k1')).toBeNull();
    await service.client.appSetting.create({ data: { key: 'k1', value: 'unrelated' } });
    expect(await store.read('k1')).toBeNull();
    await store.write('k1', 'first envelope');
    await store.write('k2', 'second envelope');

    expect(await store.read('k1')).toBe('first envelope');
    expect(await store.read('k2')).toBe('second envelope');
    expect(await store.read('k3')).toBeNull();
    expect(await rows()).toHaveLength(3);
  });

  it('rejects a second write instead of overwriting the original check', async () => {
    await store.write('k1', 'original envelope');
    const original = await rows();

    await expect(store.write('k1', 'replacement envelope')).rejects.toMatchObject({
      code: 'P2002',
    });

    expect(await rows()).toEqual(original);
  });

  it('allows only one competing insert from independent database connections', async () => {
    const other = new PrismaService({ dataDir, busyTimeoutMs: 1234 });
    await other.connect();
    try {
      const competitor = new PrismaKeyCheckStore(other);
      const results = await Promise.allSettled([
        store.write('k1', 'first envelope'),
        competitor.write('k1', 'second envelope'),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.filter((result) => result.status === 'rejected');
      expect(rejected).toHaveLength(1);
      for (const result of rejected) expect(result.reason).toMatchObject({ code: 'P2002' });
      const winner = results[0]?.status === 'fulfilled' ? 'first envelope' : 'second envelope';
      expect(await store.read('k1')).toBe(winner);
      expect(await competitor.read('k1')).toBe(winner);
      expect(await rows()).toHaveLength(1);
    } finally {
      await other.disconnect();
    }
  });

  it('propagates unavailable persistence rather than reporting an absent check', async () => {
    await service.disconnect();

    await expect(store.read('k1')).rejects.toThrow('not connected');
    await expect(store.write('k1', 'envelope')).rejects.toThrow('not connected');
    await expect(new SecretKeyBootstrap(provider, store).run()).rejects.toThrow('not connected');
    expect(existsSync(keyFilePath)).toBe(false);
  });

  it('propagates database query failures without generating a key', async () => {
    await service.client.$executeRawUnsafe('DROP TABLE app_setting');

    await expect(store.read('k1')).rejects.toMatchObject({ code: 'P2021' });
    await expect(store.write('k1', 'envelope')).rejects.toMatchObject({ code: 'P2021' });
    await expect(new SecretKeyBootstrap(provider, store).run()).rejects.toMatchObject({
      code: 'P2021',
    });
    expect(existsSync(keyFilePath)).toBe(false);
  });
});

@Injectable()
class KeyCheckConsumer {
  constructor(
    @Inject(PRISMA_SERVICE) readonly prisma: PrismaService,
    @Inject(KEY_CHECK_STORE) readonly store: PrismaKeyCheckStore,
  ) {}
}

describe('PersistenceModule key-check wiring', () => {
  it('exports the store using the same lazily connected PrismaService', async () => {
    const config = ConfigModule.forRoot({
      env: { DATA_DIR: dataDir, SQLITE_BUSY_TIMEOUT_MS: '1234' },
      envFile: join(sandbox, 'absent.env'),
      workspaceRoot: sandbox,
      home: join(sandbox, 'home'),
    });
    @Module({ imports: [PersistenceModule.forRoot(config)], providers: [KeyCheckConsumer] })
    class TestModule {}
    const context = await NestFactory.createApplicationContext(TestModule, {
      logger: false,
      abortOnError: false,
    });
    const { prisma: wiredService, store: wiredStore } = context.get(KeyCheckConsumer);
    try {
      expect(wiredStore).toBeInstanceOf(PrismaKeyCheckStore);
      await expect(wiredStore.read('k1')).rejects.toThrow('not connected');
      await wiredService.connect();
      await new SecretKeyBootstrap(provider, wiredStore).run();
      expect(await store.read('k1')).toBe(await wiredStore.read('k1'));
    } finally {
      await context.close();
    }
    await expect(wiredStore.read('k1')).rejects.toThrow('not connected');
  });
});
