import { join } from 'node:path';

/** The database file inside the configured data directory. */
export const DATABASE_FILE_NAME = 'importer.db';

/** Absolute path of the database file for an absolute data directory. */
export function databaseFilePath(dataDir: string): string {
  return join(dataDir, DATABASE_FILE_NAME);
}

/** The `file:` connection URL Prisma expects for that database. */
export function databaseUrl(dataDir: string): string {
  return `file:${databaseFilePath(dataDir)}`;
}
