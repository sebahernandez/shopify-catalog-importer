import { statSync, type BigIntStats } from 'node:fs';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client.js';
import { verifyConnectionSettings, type ConnectionSettings } from './connection-settings.js';
import { databaseFilePath, databaseUrl, prepareDatabaseFile } from './database-location.js';
import { EXPECTED_TABLES } from './expected-tables.js';
import { PersistenceError } from './persistence-error.js';

export interface PrismaServiceOptions {
  /** Absolute data directory (`DATA_DIR`, already resolved by the config loader). */
  readonly dataDir: string;
  /** `SQLITE_BUSY_TIMEOUT_MS`. */
  readonly busyTimeoutMs: number;
}

const MIGRATE_HINT = 'Run `pnpm db:migrate` to apply the migrations, then start the API again.';

/** The first value of the first row, which is how SQLite answers a `PRAGMA` query. */
async function pragma(client: PrismaClient, statement: string): Promise<unknown> {
  const rows = await client.$queryRawUnsafe<Record<string, unknown>[]>(`PRAGMA ${statement}`);
  return Object.values(rows[0] ?? {})[0];
}

/**
 * The application's one database connection. A plain class on purpose: the framework wiring and
 * the shutdown hook live in `persistence.module.ts`, and the ordered boot calls `connect()`.
 *
 * `connect()` creates the data directory and the file when absent, opens the file through the
 * explicit better-sqlite3 driver adapter (one connection, which holds the settings below), and
 * then refuses to continue unless every table of `EXPECTED_TABLES` exists. It never migrates.
 */
export class PrismaService {
  readonly #options: PrismaServiceOptions;
  #client: PrismaClient | undefined;
  #identity: BigIntStats | undefined;

  constructor(options: PrismaServiceOptions) {
    this.#options = options;
  }

  /** The connected client. Throws when `connect()` has not completed. */
  get client(): PrismaClient {
    if (!this.#client) throw new Error('PrismaService is not connected; call connect() first.');
    return this.#client;
  }

  async connect(): Promise<void> {
    if (this.#client) return;
    const { dataDir, busyTimeoutMs } = this.#options;
    const file = prepareDatabaseFile(dataDir);
    // The adapter takes the busy timeout as a driver option. WAL and foreign keys are statements:
    // the adapter has no pragma option, and it holds a single connection, so they stay in force.
    const client = new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: databaseUrl(dataDir), timeout: busyTimeoutMs }),
    });
    try {
      await client.$connect();
      await pragma(client, 'journal_mode = WAL');
      await pragma(client, 'foreign_keys = ON');
      const expected: ConnectionSettings = { journalMode: 'wal', busyTimeoutMs, foreignKeys: true };
      verifyConnectionSettings(
        {
          journalMode: await pragma(client, 'journal_mode'),
          busyTimeoutMs: await pragma(client, 'busy_timeout'),
          foreignKeys: await pragma(client, 'foreign_keys'),
        },
        expected,
      );
      const names = EXPECTED_TABLES.map((name) => `'${name}'`).join(', ');
      const present = await client.$queryRawUnsafe(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${names})`,
      );
      if (!Array.isArray(present) || present.length < EXPECTED_TABLES.length) {
        throw new PersistenceError(
          'MIGRATION_REQUIRED',
          `The database has not been migrated yet. ${MIGRATE_HINT}`,
        );
      }
      this.#identity = statSync(file, { bigint: true });
    } catch (error) {
      await client.$disconnect().catch(() => undefined);
      if (error instanceof PersistenceError) throw error;
      const reason = error instanceof Error ? error.message : 'unknown error';
      throw new PersistenceError(
        'DATABASE_SETUP_FAILED',
        `Could not open the database in DATA_DIR: ${reason}`,
      );
    }
    this.#client = client;
  }

  /**
   * True when the connection is open, the file is still the one that was opened and a trivial
   * query succeeds. Never throws: a removed or replaced file (which an open handle would hide on
   * POSIX) and any driver error both report false.
   */
  async isReachable(): Promise<boolean> {
    const client = this.#client;
    const identity = this.#identity;
    if (!client || !identity) return false;
    try {
      const current = statSync(databaseFilePath(this.#options.dataDir), { bigint: true });
      if (current.ino !== identity.ino || current.dev !== identity.dev) return false;
      await client.$queryRawUnsafe('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /** Releases the connection. Safe to call when not connected and more than once. */
  async disconnect(): Promise<void> {
    const client = this.#client;
    this.#client = undefined;
    this.#identity = undefined;
    if (client) await client.$disconnect();
  }
}
