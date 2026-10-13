import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../config/load-config.js';
import { databaseFilePath } from './database-location.js';

// Runs the real Prisma CLI (`migrate deploy`, the command behind `pnpm db:migrate`) against a
// database inside a fresh temporary directory. The data directory and the whole environment are
// passed explicitly, and HOME points into the sandbox, so nothing here can reach the default data
// directory or the real home directory.
const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
const migrationsDir = join(apiRoot, 'prisma', 'migrations');

let sandbox: string;
let dataDir: string;

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), 'importer-migration-'));
  dataDir = join(sandbox, 'data');
});

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

function migrate(): { status: number | null; output: string } {
  const run = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
    cwd: apiRoot,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      PATH: dirname(process.execPath),
      HOME: join(sandbox, 'home'),
      DATA_DIR: dataDir,
      CHECKPOINT_DISABLE: '1',
      PRISMA_HIDE_UPDATE_MESSAGE: '1',
    },
  });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}

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

function committedMigrations(): string[] {
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

describe('baseline migration', () => {
  it('is a single committed baseline with a lock file', () => {
    const names = committedMigrations();
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/^\d{14}_baseline$/);
    expect(readFileSync(join(migrationsDir, 'migration_lock.toml'), 'utf8')).toContain(
      'provider = "sqlite"',
    );
  });

  it('applies the committed SQL to an empty database and records it', () => {
    const [name] = committedMigrations();
    const sql = readFileSync(join(migrationsDir, name ?? '', 'migration.sql'));

    const first = migrate();

    expect(first.status).toBe(0);
    const applied = inspect((db) =>
      db.prepare('SELECT * FROM _prisma_migrations').all(),
    ) as AppliedMigration[];
    expect(applied).toHaveLength(1);
    expect(applied[0]).toMatchObject({ migration_name: name, applied_steps_count: 1 });
    expect(applied[0]?.finished_at).not.toBeNull();
    // Prisma stores the SHA-256 of the SQL it ran: it is exactly the committed file.
    expect(applied[0]?.checksum).toBe(createHash('sha256').update(sql).digest('hex'));
  });

  it('changes nothing and exits 0 when applied again', () => {
    expect(migrate().status).toBe(0);
    const before = inspect((db) => db.prepare('SELECT * FROM _prisma_migrations').all());
    expect(before).toHaveLength(1);

    const again = migrate();

    expect(again.status).toBe(0);
    expect(again.output).toContain('No pending migrations to apply');
    expect(inspect((db) => db.prepare('SELECT * FROM _prisma_migrations').all())).toEqual(before);
  });

  it('creates only app_setting, empty, with the columns of design D3', () => {
    expect(migrate().status).toBe(0);

    inspect((db) => {
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all();
      expect(tables).toEqual([{ name: '_prisma_migrations' }, { name: 'app_setting' }]);
      expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all()).toEqual([
        { name: 'sqlite_autoindex__prisma_migrations_1' },
        { name: 'sqlite_autoindex_app_setting_1' },
      ]);
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
