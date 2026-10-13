import { chmodSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { databaseFilePath, prepareDatabaseFile } from './database-location.js';
import { PersistenceError } from './persistence-error.js';

// Only fresh temporary directories are used; the data directory is always passed explicitly.
const posixOnly = process.platform === 'win32';
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;

let sandbox: string;

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), 'importer-location-'));
});

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

const mode = (path: string) => statSync(path).mode & 0o777;

function captured(action: () => unknown): PersistenceError {
  try {
    action();
  } catch (error) {
    if (error instanceof PersistenceError) return error;
    throw error;
  }
  throw new Error('expected a PersistenceError');
}

describe.skipIf(posixOnly)('prepareDatabaseFile', () => {
  it('creates the directory 0700 and an empty database file 0600, whatever the umask', () => {
    const dataDir = join(sandbox, 'nested', 'data');
    const previous = process.umask(0);
    try {
      expect(prepareDatabaseFile(dataDir)).toBe(databaseFilePath(dataDir));
    } finally {
      process.umask(previous);
    }

    expect(mode(dataDir)).toBe(0o700);
    expect(mode(join(sandbox, 'nested'))).toBe(0o700);
    expect(mode(databaseFilePath(dataDir))).toBe(0o600);
    expect(statSync(databaseFilePath(dataDir)).size).toBe(0);
  });

  it('keeps an existing database untouched and tightens a group-readable file to 0600', () => {
    const dataDir = join(sandbox, 'data');
    mkdirSync(dataDir, { mode: 0o700 });
    const file = databaseFilePath(dataDir);
    writeFileSync(file, 'existing bytes', { mode: 0o644 });
    chmodSync(file, 0o644);

    prepareDatabaseFile(dataDir);

    expect(readFileSync(file, 'utf8')).toBe('existing bytes');
    expect(mode(file)).toBe(0o600);
  });

  it('refuses an existing directory that group or others can reach, naming DATA_DIR', () => {
    const dataDir = join(sandbox, 'data');
    mkdirSync(dataDir);
    chmodSync(dataDir, 0o755);

    const error = captured(() => prepareDatabaseFile(dataDir));

    expect(error.code).toBe('DATA_DIR_UNUSABLE');
    expect(error.message).toContain('DATA_DIR');
    expect(error.message).toContain('chmod 700');
  });

  it('refuses a data directory that is a regular file, naming DATA_DIR', () => {
    const dataDir = join(sandbox, 'not-a-directory');
    writeFileSync(dataDir, 'x');

    const error = captured(() => prepareDatabaseFile(dataDir));

    expect(error.code).toBe('DATA_DIR_UNUSABLE');
    expect(error.message).toContain('DATA_DIR');
  });

  it.skipIf(isRoot)('refuses a location that cannot be written, naming DATA_DIR', () => {
    const parent = join(sandbox, 'read-only');
    mkdirSync(parent, { mode: 0o700 });
    chmodSync(parent, 0o500);
    try {
      const error = captured(() => prepareDatabaseFile(join(parent, 'data')));

      expect(error.code).toBe('DATA_DIR_UNUSABLE');
      expect(error.message).toContain('DATA_DIR');
      expect(error.message).toContain('EACCES');
    } finally {
      chmodSync(parent, 0o700);
    }
  });
});
