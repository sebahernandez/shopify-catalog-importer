export type BootErrorCode = 'KEY_FILE_INVALID' | 'KEY_FILE_REQUIRED' | 'KEY_MISMATCH';

/**
 * A fatal start-up condition. The caller (`main.ts`) maps it to a non-zero exit code; code that
 * throws it never exits or logs. Messages are operator-facing and never carry key material.
 * Later start-up steps add their own codes to the union.
 */
export class BootError extends Error {
  readonly code: BootErrorCode;

  constructor(code: BootErrorCode, message: string) {
    super(message);
    this.name = 'BootError';
    this.code = code;
  }
}
