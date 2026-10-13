import { PersistenceError } from './persistence-error.js';

/** What every connection must be running with before the service reports itself usable. */
export interface ConnectionSettings {
  readonly journalMode: 'wal';
  readonly busyTimeoutMs: number;
  readonly foreignKeys: boolean;
}

/** The values as read back from SQLite. The driver may return integers as numbers or bigints. */
export interface RawConnectionSettings {
  readonly journalMode: unknown;
  readonly busyTimeoutMs: unknown;
  readonly foreignKeys: unknown;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' || typeof value === 'bigint' ? Number(value) : undefined;
}

/**
 * Compares what SQLite reports with what was asked for and throws one error listing every
 * setting that did not take effect. A silent mismatch would mean slower writes, lost foreign key
 * checks or an unexpected timeout, so the boot stops instead.
 */
export function verifyConnectionSettings(
  actual: RawConnectionSettings,
  expected: ConnectionSettings,
): void {
  const wrong: string[] = [];
  if (actual.journalMode !== expected.journalMode) wrong.push('journal_mode');
  if (asNumber(actual.busyTimeoutMs) !== expected.busyTimeoutMs) wrong.push('busy_timeout');
  if (asNumber(actual.foreignKeys) !== (expected.foreignKeys ? 1 : 0)) wrong.push('foreign_keys');
  if (wrong.length > 0) {
    throw new PersistenceError(
      'DATABASE_SETUP_FAILED',
      `The database did not accept the required settings (${wrong.join(', ')}). ` +
        'Write-ahead logging needs a local file system; check DATA_DIR and SQLITE_BUSY_TIMEOUT_MS.',
    );
  }
}
