/**
 * Authenticated encryption of short secrets at rest. `context` binds an envelope to the place it
 * belongs (for example a record and field name), so it cannot be moved to another row or field.
 * Implementations throw `SecretBoxError` and never include key material, plaintext or the
 * envelope in an error.
 */
export interface SecretBox {
  encrypt(plaintext: string, context: string): string;
  decrypt(envelope: string, context: string): string;
}
