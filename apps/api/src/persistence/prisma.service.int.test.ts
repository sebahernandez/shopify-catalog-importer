import 'reflect-metadata';
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { NestFactory } from '@nestjs/core';
import { Inject, Injectable, Module } from '@nestjs/common';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_CONFIG, ConfigModule } from '../config/config.module.js';
import type { AppConfig } from '../config/load-config.js';
import { databaseFilePath, prepareDatabaseFile } from './database-location.js';
import { PersistenceError } from './persistence-error.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { PersistenceModule, PRISMA_SERVICE } from './persistence.module.js';
import { PrismaService } from './prisma.service.js';

// Every database lives in a fresh temporary directory created here and removed afterwards. The
// data directory and the busy timeout are passed explicitly; nothing falls back to ./data. The
// timeout is deliberately not the SQLite or driver default (5000), so a missing setting shows.
const BUSY_TIMEOUT_MS = 1234;
const migrationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'prisma',
  'migrations',
);

let sandbox: string;
let dataDir: string;
const opened: PrismaService[] = [];

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), 'importer-service-'));
  dataDir = join(sandbox, 'data');
});

afterEach(async () => {
  for (const service of opened.splice(0)) await service.disconnect();
  vi.restoreAllMocks();
  await rm(sandbox, { recursive: true, force: true });
});

function newService(options: { dataDir?: string; busyTimeoutMs?: number } = {}): PrismaService {
  const service = new PrismaService({
    dataDir: options.dataDir ?? dataDir,
    busyTimeoutMs: options.busyTimeoutMs ?? BUSY_TIMEOUT_MS,
  });
  opened.push(service);
  return service;
}

/** Creates the database file and applies the committed baseline SQL to it, as `db:migrate` does. */
function migrateDirectly(): void {
  const [name] = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const sql = readFileSync(join(migrationsDir, name ?? '', 'migration.sql'), 'utf8');
  prepareDatabaseFile(dataDir);
  const db = new Database(databaseFilePath(dataDir));
  try {
    db.exec(sql);
  } finally {
    db.close();
  }
}

async function pragma(service: PrismaService, name: string): Promise<unknown> {
  const rows = await service.client.$queryRawUnsafe<Record<string, unknown>[]>(`PRAGMA ${name}`);
  return Object.values(rows[0] ?? {})[0];
}

async function rejection(promise: Promise<unknown>): Promise<PersistenceError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof PersistenceError) return error;
    throw error;
  }
  throw new Error('expected a PersistenceError');
}

describe('PrismaService connection', () => {
  it('creates the database file when absent, then refuses to serve until it is migrated', async () => {
    const service = newService();
    expect(existsSync(dataDir)).toBe(false);

    const error = await rejection(service.connect());

    expect(error.code).toBe('MIGRATION_REQUIRED');
    expect(error.message).toContain('pnpm db:migrate');
    // The file was opened and created before the refusal, and the refusal left no open handle.
    expect(existsSync(databaseFilePath(dataDir))).toBe(true);
    expect(readdirSync(dataDir)).toEqual(['importer.db']);
    expect(() => service.client).toThrow('not connected');
    expect(await service.isReachable()).toBe(false);
  });

  it('connects to a migrated database whose table holds no rows', async () => {
    migrateDirectly();
    const service = newService();

    await service.connect();

    expect(await service.client.appSetting.count()).toBe(0);
    expect(await service.isReachable()).toBe(true);
  });

  it('uses write-ahead logging, the configured busy timeout and enforced foreign keys', async () => {
    migrateDirectly();
    const service = newService();

    await service.connect();

    expect(await pragma(service, 'journal_mode')).toBe('wal');
    expect(Number(await pragma(service, 'busy_timeout'))).toBe(BUSY_TIMEOUT_MS);
    expect(Number(await pragma(service, 'foreign_keys'))).toBe(1);
    // The journal mode is stored in the file, so an unrelated handle sees it too.
    const other = new Database(databaseFilePath(dataDir), { readonly: true });
    try {
      expect(other.pragma('journal_mode', { simple: true })).toBe('wal');
    } finally {
      other.close();
    }
  });

  it('applies a different busy timeout when configured differently', async () => {
    migrateDirectly();
    const service = newService({ busyTimeoutMs: 777 });

    await service.connect();

    expect(Number(await pragma(service, 'busy_timeout'))).toBe(777);
  });

  it('reads and writes app_setting through the adapter', async () => {
    migrateDirectly();
    const service = newService();
    await service.connect();

    await service.client.appSetting.create({ data: { key: 'greeting', value: 'hello' } });
    await service.client.appSetting.update({
      where: { key: 'greeting' },
      data: { value: 'again' },
    });

    const row = await service.client.appSetting.findUnique({ where: { key: 'greeting' } });
    expect(row).toMatchObject({ key: 'greeting', value: 'again' });
    expect(row?.updatedAt).toBeInstanceOf(Date);
    expect(await service.client.appSetting.count()).toBe(1);
  });

  it('opens one connection and keeps its settings across queries and transactions', async () => {
    migrateDirectly();
    const connect = vi.spyOn(PrismaBetterSqlite3.prototype, 'connect');
    const service = newService();

    await service.connect();
    await service.connect();
    const readings = await Promise.all(
      Array.from({ length: 8 }, () => pragma(service, 'foreign_keys')),
    );
    await service.client.$transaction(async (tx) => {
      await tx.appSetting.create({ data: { key: 'a', value: '1' } });
    });

    expect(connect).toHaveBeenCalledTimes(1);
    expect(readings.map(Number)).toEqual(Array(8).fill(1));
    expect(Number(await pragma(service, 'busy_timeout'))).toBe(BUSY_TIMEOUT_MS);
  });

  it('reports a file that is not a database as a setup failure and releases it', async () => {
    prepareDatabaseFile(dataDir);
    writeFileSync(databaseFilePath(dataDir), 'this is not a SQLite database, '.repeat(40));
    const service = newService();

    const error = await rejection(service.connect());

    expect(error.code).toBe('DATABASE_SETUP_FAILED');
    expect(error.message).toContain('DATA_DIR');
    expect(() => service.client).toThrow('not connected');
    expect(readdirSync(dataDir)).toEqual(['importer.db']);
  });

  it('refuses to serve when the read-back shows WAL did not take effect', async () => {
    migrateDirectly();
    // The generated client is untyped for the compiler (it carries @ts-nocheck), so describe the
    // one method this test replaces.
    type RawQuery = (query: string, ...values: unknown[]) => Promise<unknown>;
    const prototype = PrismaClient.prototype as { $queryRawUnsafe: RawQuery };
    const original = prototype.$queryRawUnsafe;
    // The file system answers "delete" to the read-back, as a network share would.
    vi.spyOn(prototype, '$queryRawUnsafe').mockImplementation(function (
      this: unknown,
      query: string,
      ...values: unknown[]
    ) {
      if (query === 'PRAGMA journal_mode') return Promise.resolve([{ journal_mode: 'delete' }]);
      return original.call(this, query, ...values);
    });
    const service = newService();

    const error = await rejection(service.connect());

    expect(error.code).toBe('DATABASE_SETUP_FAILED');
    expect(error.message).toContain('journal_mode');
    expect(() => service.client).toThrow('not connected');
  });

  it('names DATA_DIR and leaves nothing behind when the location is unusable', async () => {
    writeFileSync(join(sandbox, 'plain-file'), 'x');
    const service = newService({ dataDir: join(sandbox, 'plain-file') });

    const error = await rejection(service.connect());

    expect(error.code).toBe('DATA_DIR_UNUSABLE');
    expect(error.message).toContain('DATA_DIR');
    expect(() => service.client).toThrow('not connected');
  });
});

describe('PrismaService readiness and shutdown', () => {
  it('is not reachable before connecting', async () => {
    migrateDirectly();

    expect(await newService().isReachable()).toBe(false);
  });

  it('reports false, without throwing, once the database file has been removed', async () => {
    migrateDirectly();
    const service = newService();
    await service.connect();
    expect(await service.isReachable()).toBe(true);

    rmSync(databaseFilePath(dataDir));

    expect(await service.isReachable()).toBe(false);
  });

  it('reports false when the file was replaced by another one', async () => {
    migrateDirectly();
    const service = newService();
    await service.connect();

    rmSync(databaseFilePath(dataDir));
    writeFileSync(databaseFilePath(dataDir), '');

    expect(await service.isReachable()).toBe(false);
  });

  it('releases the connection on disconnect and can be disconnected twice', async () => {
    migrateDirectly();
    const service = newService();
    await service.connect();
    await service.client.appSetting.create({ data: { key: 'k', value: 'v' } });

    await service.disconnect();
    await service.disconnect();

    expect(() => service.client).toThrow('not connected');
    expect(await service.isReachable()).toBe(false);
    // Closing the last connection checkpoints the log, so only the database itself remains.
    expect(readdirSync(dataDir)).toEqual(['importer.db']);
  });
});

describe.skipIf(process.platform === 'win32')('PrismaService permissions', () => {
  it('keeps the directory 0700 and the database and its WAL files 0600', async () => {
    migrateDirectly();
    const service = newService();
    await service.connect();
    await service.client.appSetting.create({ data: { key: 'k', value: 'v' } });

    const names = readdirSync(dataDir).sort();
    expect(names).toEqual(['importer.db', 'importer.db-shm', 'importer.db-wal']);
    expect(statSync(dataDir).mode & 0o777).toBe(0o700);
    for (const name of names) expect(statSync(join(dataDir, name)).mode & 0o777).toBe(0o600);
  });
});

@Injectable()
class Consumer {
  constructor(@Inject(PRISMA_SERVICE) readonly prisma: PrismaService) {}
}

describe('PersistenceModule', () => {
  function appModule() {
    const config = ConfigModule.forRoot({
      env: { DATA_DIR: dataDir, SQLITE_BUSY_TIMEOUT_MS: String(BUSY_TIMEOUT_MS) },
      envFile: join(sandbox, 'absent.env'),
      workspaceRoot: sandbox,
      home: join(sandbox, 'home'),
    });
    @Module({ imports: [config, PersistenceModule.forRoot(config)], providers: [Consumer] })
    class TestModule {}
    return TestModule;
  }

  it('builds the service from the loaded configuration and disconnects it on shutdown', async () => {
    migrateDirectly();
    const context = await NestFactory.createApplicationContext(appModule(), { logger: false });
    const service = context.get(Consumer).prisma;
    opened.push(service);
    try {
      expect(service).toBeInstanceOf(PrismaService);
      // Wiring does not connect: the ordered boot decides when (design, boot path).
      expect(await service.isReachable()).toBe(false);
      await service.connect();
      expect(Number(await pragma(service, 'busy_timeout'))).toBe(BUSY_TIMEOUT_MS);
      expect(context.get<AppConfig>(APP_CONFIG, { strict: false }).dataDir).toBe(dataDir);
    } finally {
      await context.close();
    }

    expect(() => service.client).toThrow('not connected');
  });
});
