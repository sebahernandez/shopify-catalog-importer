import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyMigrations, committedMigrations } from './apply-migrations.js';

let sandbox: string;

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), 'importer-helper-'));
});

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

function read<T>(query: string): T[] {
  const db = new Database(join(sandbox, 'data', 'importer.db'), { readonly: true });
  try {
    return db.prepare(query).all() as T[];
  } finally {
    db.close();
  }
}

const history = () =>
  read<{ migration_name: string }>('SELECT migration_name FROM _prisma_migrations').map(
    (row) => row.migration_name,
  );

describe('applyMigrations', () => {
  it('applies every committed migration in order inside the sandbox only', () => {
    const run = applyMigrations(sandbox);

    expect(run.status).toBe(0);
    expect(history()).toEqual(committedMigrations());
    expect(existsSync(join(sandbox, 'data', 'importer.db'))).toBe(true);
  });

  it('exits 0 and changes nothing when run again', () => {
    applyMigrations(sandbox);
    const before = read('SELECT * FROM _prisma_migrations');

    const again = applyMigrations(sandbox);

    expect(again.status).toBe(0);
    expect(again.output).toContain('No pending migrations to apply');
    expect(read('SELECT * FROM _prisma_migrations')).toEqual(before);
  });

  it('can stop after the baseline migration', () => {
    const run = applyMigrations(sandbox, { baselineOnly: true });

    expect(run.status).toBe(0);
    expect(history()).toEqual(committedMigrations().slice(0, 1));
    expect(read("SELECT name FROM sqlite_master WHERE name = 'store'")).toEqual([]);
  });
});
