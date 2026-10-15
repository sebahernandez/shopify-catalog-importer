import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config/load-config.js';
import { databaseFilePath } from './database-location.js';
import { applyMigrations, committedMigrations } from './test-support/apply-migrations.js';

// Every database lives in a fresh temporary directory; the helper runs the real Prisma CLI with
// the data directory and HOME inside it.
const migrationsDir = join(import.meta.dirname, '..', '..', 'prisma', 'migrations');

let sandbox: string;
let dataDir: string;

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), 'importer-migration-'));
  dataDir = join(sandbox, 'data');
});

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

const migrate = () => applyMigrations(sandbox);

interface AppliedMigration {
  migration_name: string;
  checksum: string;
  finished_at: string | null;
  applied_steps_count: number;
}

function inspect<T>(read: (db: Database.Database) => T): T {
  const db = new Database(databaseFilePath(dataDir), { readonly: true, fileMustExist: true });
  try {
    return read(db);
  } finally {
    db.close();
  }
}

const tableNames = () =>
  inspect((db) =>
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all(),
  );

describe('committed migrations', () => {
  it('are the baseline then the stores migration, with a lock file', () => {
    const names = committedMigrations();
    expect(names).toHaveLength(2);
    expect(names[0]).toMatch(/^\d{14}_baseline$/);
    expect(names[1]).toMatch(/^\d{14}_stores$/);
    expect(readFileSync(join(migrationsDir, 'migration_lock.toml'), 'utf8')).toContain(
      'provider = "sqlite"',
    );
  });

  it('apply to an empty database and record each one with its checksum', () => {
    const first = migrate();

    expect(first.status).toBe(0);
    const applied = inspect((db) =>
      db.prepare('SELECT * FROM _prisma_migrations ORDER BY migration_name').all(),
    ) as AppliedMigration[];
    expect(applied.map((row) => row.migration_name)).toEqual(committedMigrations());
    for (const row of applied) {
      const sql = readFileSync(join(migrationsDir, row.migration_name, 'migration.sql'));
      expect(row.finished_at).not.toBeNull();
      // Prisma stores the SHA-256 of the SQL it ran: it is exactly the committed file.
      expect(row.checksum).toBe(createHash('sha256').update(sql).digest('hex'));
    }
    expect(tableNames()).toEqual([
      { name: '_prisma_migrations' },
      { name: 'app_setting' },
      { name: 'store' },
    ]);
  });

  it('upgrade a baseline database, keeping the app_setting row and creating store', () => {
    expect(applyMigrations(sandbox, { baselineOnly: true }).status).toBe(0);
    expect(tableNames()).toEqual([{ name: '_prisma_migrations' }, { name: 'app_setting' }]);
    const db = new Database(databaseFilePath(dataDir));
    db.prepare("INSERT INTO app_setting (key, value) VALUES ('secret_key_check', 'sb1.x')").run();
    db.close();
    const before = inspect((d) => d.prepare('SELECT * FROM app_setting').all());

    expect(migrate().status).toBe(0);

    expect(inspect((d) => d.prepare('SELECT * FROM app_setting').all())).toEqual(before);
    expect(tableNames()).toContainEqual({ name: 'store' });
  });

  it('change nothing and exit 0 when applied again', () => {
    expect(migrate().status).toBe(0);
    const before = inspect((db) => db.prepare('SELECT * FROM _prisma_migrations').all());
    expect(before).toHaveLength(2);

    const again = migrate();

    expect(again.status).toBe(0);
    expect(again.output).toContain('No pending migrations to apply');
    expect(inspect((db) => db.prepare('SELECT * FROM _prisma_migrations').all())).toEqual(before);
  });

  it('create app_setting with the columns of design D3', () => {
    expect(migrate().status).toBe(0);

    inspect((db) => {
      const columns = db
        .prepare(
          'SELECT name, type, "notnull", dflt_value, pk FROM pragma_table_info(\'app_setting\')',
        )
        .all();
      expect(columns).toEqual([
        { name: 'key', type: 'TEXT', notnull: 1, dflt_value: null, pk: 1 },
        { name: 'value', type: 'TEXT', notnull: 1, dflt_value: null, pk: 0 },
        {
          name: 'updated_at',
          type: 'DATETIME',
          notnull: 1,
          dflt_value: 'CURRENT_TIMESTAMP',
          pk: 0,
        },
      ]);
      expect(db.prepare('SELECT count(*) AS rows FROM app_setting').get()).toEqual({ rows: 0 });
    });
  });
});

describe('store table', () => {
  it('has exactly the specified columns, with the snapshot as TEXT', () => {
    expect(migrate().status).toBe(0);

    const columns = inspect((db) =>
      db.prepare("SELECT name, type FROM pragma_table_info('store')").all(),
    ) as { name: string; type: string }[];
    expect(columns.map((column) => column.name)).toEqual([
      'id',
      'display_name',
      'shop_domain',
      'shopify_shop_id',
      'api_version',
      'auth_kind',
      'credentials_envelope',
      'status',
      'last_verified_at',
      'last_verification',
      'created_at',
      'updated_at',
    ]);
    expect(columns.find((column) => column.name === 'last_verification')?.type).toBe('TEXT');
  });

  it('rejects a second row with the same shop_domain', () => {
    expect(migrate().status).toBe(0);
    const db = new Database(databaseFilePath(dataDir));
    const insert = db.prepare(
      `INSERT INTO store (id, display_name, shop_domain, auth_kind, credentials_envelope, status)
       VALUES (?, 'Demo', 'demo.myshopify.com', 'static_token', 'sb1.x', 'UNVERIFIED')`,
    );
    try {
      insert.run('a');
      expect(() => insert.run('b')).toThrow(/UNIQUE constraint failed: store.shop_domain/);
    } finally {
      db.close();
    }
  });

  it('is absent from a baseline-only database, which therefore holds no credential', () => {
    expect(applyMigrations(sandbox, { baselineOnly: true }).status).toBe(0);

    expect(tableNames()).not.toContainEqual({ name: 'store' });
    expect(inspect((db) => db.prepare('SELECT * FROM app_setting').all())).toEqual([]);
  });
});

describe('migration runs', () => {
  it('puts the database where the application configuration says', () => {
    expect(migrate().status).toBe(0);

    // The Prisma config and the API both derive the location from loadConfig.
    const expected = databaseFilePath(loadConfig({ env: { DATA_DIR: dataDir } }).dataDir);
    expect(expected).toBe(join(dataDir, 'importer.db'));
    expect(existsSync(expected)).toBe(true);
  });

  it.skipIf(process.platform === 'win32')(
    'creates the data directory 0700 and the database file 0600',
    () => {
      expect(migrate().status).toBe(0);

      expect(statSync(dataDir).mode & 0o777).toBe(0o700);
      expect(statSync(databaseFilePath(dataDir)).mode & 0o777).toBe(0o600);
    },
  );
});
