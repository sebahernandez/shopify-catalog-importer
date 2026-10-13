export type PersistenceErrorCode =
  'DATA_DIR_UNUSABLE' | 'MIGRATION_REQUIRED' | 'DATABASE_SETUP_FAILED';

/**
 * A fatal persistence start-up condition. The caller (`main.ts`) maps it to a non-zero exit; code
 * that throws it never exits or logs. Messages are operator-facing and hold no stored value.
 */
export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;

  constructor(code: PersistenceErrorCode, message: string) {
    super(message);
    this.name = 'PersistenceError';
    this.code = code;
  }
}
