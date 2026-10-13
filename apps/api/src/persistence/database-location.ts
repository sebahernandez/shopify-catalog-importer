import { closeSync, fchmodSync, fstatSync, mkdirSync, openSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PersistenceError } from './persistence-error.js';

/** The database file inside the configured data directory. */
export const DATABASE_FILE_NAME = 'importer.db';

const OWNER_ONLY_DIRECTORY = 0o700;
const OWNER_ONLY_FILE = 0o600;
const GROUP_AND_OTHER = 0o077;

/** Absolute path of the database file for an absolute data directory. */
export function databaseFilePath(dataDir: string): string {
  return join(dataDir, DATABASE_FILE_NAME);
}

/** The `file:` connection URL Prisma expects for that database. */
export function databaseUrl(dataDir: string): string {
  return `file:${databaseFilePath(dataDir)}`;
}

function unusable(detail: string): PersistenceError {
  return new PersistenceError('DATA_DIR_UNUSABLE', `DATA_DIR ${detail}`);
}

/**
 * Makes sure the data directory and an empty database file exist, readable by the owner only, and
 * returns the file path. The directory is created with mode 0700 (parents too) and a new file with
 * mode 0600, whatever the umask. An existing directory that group or others can reach is refused:
 * it will hold encrypted credentials, and quietly changing the permissions of a directory the
 * operator chose could hit something else. An existing file is kept as it is and tightened to 0600
 * when it is wider. SQLite gives its `-wal` and `-shm` files the mode of the database file, and the
 * directory mode covers them either way. Mode bits do not exist on Windows and are not checked.
 */
export function prepareDatabaseFile(dataDir: string): string {
  const file = databaseFilePath(dataDir);
  const posix = process.platform !== 'win32';
  try {
    mkdirSync(dataDir, { recursive: true, mode: OWNER_ONLY_DIRECTORY });
    if (posix && (statSync(dataDir).mode & GROUP_AND_OTHER) !== 0) {
      throw unusable(`${dataDir} can be reached by group or other users; run chmod 700 on it.`);
    }
    const descriptor = openSync(file, 'a', OWNER_ONLY_FILE);
    try {
      if (posix && (fstatSync(descriptor).mode & GROUP_AND_OTHER) !== 0) {
        fchmodSync(descriptor, OWNER_ONLY_FILE);
      }
    } finally {
      closeSync(descriptor);
    }
  } catch (error) {
    if (error instanceof PersistenceError) throw error;
    const code = (error as NodeJS.ErrnoException).code ?? 'unknown error';
    throw unusable(`${dataDir} cannot be created or written (${code}).`);
  }
  return file;
}
