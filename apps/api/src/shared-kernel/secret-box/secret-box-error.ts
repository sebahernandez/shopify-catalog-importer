export type SecretBoxErrorCode =
  'KEY_MISSING' | 'INVALID_KEY' | 'INVALID_INPUT' | 'MALFORMED_ENVELOPE' | 'DECRYPT_FAILED';

/**
 * Raised by every `SecretBox` implementation. Messages are fixed text: they never carry key
 * material, plaintext, ciphertext or the envelope, and there is never a `cause`.
 * `DECRYPT_FAILED` is the one generic code for any authentication failure, so a wrong key and
 * tampered data cannot be told apart.
 */
export class SecretBoxError extends Error {
  readonly code: SecretBoxErrorCode;

  constructor(code: SecretBoxErrorCode, message: string) {
    super(message);
    this.name = 'SecretBoxError';
    this.code = code;
  }
}
