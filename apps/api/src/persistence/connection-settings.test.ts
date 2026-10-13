import { describe, expect, it } from 'vitest';
import {
  verifyConnectionSettings,
  type ConnectionSettings,
  type RawConnectionSettings,
} from './connection-settings.js';
import { PersistenceError } from './persistence-error.js';

const expected: ConnectionSettings = { journalMode: 'wal', busyTimeoutMs: 4321, foreignKeys: true };

function failure(actual: RawConnectionSettings): PersistenceError {
  try {
    verifyConnectionSettings(actual, expected);
  } catch (error) {
    if (error instanceof PersistenceError) return error;
    throw error;
  }
  throw new Error('expected a PersistenceError');
}

describe('verifyConnectionSettings', () => {
  it('accepts the values read back, whatever integer type the driver returns', () => {
    for (const timeout of [4321, 4321n]) {
      expect(() =>
        verifyConnectionSettings(
          { journalMode: 'wal', busyTimeoutMs: timeout, foreignKeys: 1n },
          expected,
        ),
      ).not.toThrow();
    }
  });

  it.each([
    ['journal_mode', { journalMode: 'delete', busyTimeoutMs: 4321, foreignKeys: 1 }],
    ['journal_mode', { journalMode: 'memory', busyTimeoutMs: 4321, foreignKeys: 1 }],
    ['busy_timeout', { journalMode: 'wal', busyTimeoutMs: 5000, foreignKeys: 1 }],
    ['busy_timeout', { journalMode: 'wal', busyTimeoutMs: undefined, foreignKeys: 1 }],
    ['foreign_keys', { journalMode: 'wal', busyTimeoutMs: 4321, foreignKeys: 0 }],
    ['foreign_keys', { journalMode: 'wal', busyTimeoutMs: 4321, foreignKeys: 0n }],
  ])('names %s when it did not take effect', (setting, actual) => {
    const error = failure(actual);

    expect(error.code).toBe('DATABASE_SETUP_FAILED');
    expect(error.message).toContain(setting);
  });

  it('lists every setting that is wrong', () => {
    const error = failure({ journalMode: 'delete', busyTimeoutMs: 1, foreignKeys: 0 });

    for (const name of ['journal_mode', 'busy_timeout', 'foreign_keys'])
      expect(error.message).toContain(name);
  });
});
