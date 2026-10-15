/**
 * The stored credentials of a store cannot be read: wrong store, tampered data, a different key
 * or a shape that does not match the auth kind. The message is fixed and there is no `cause`, so
 * neither the envelope nor a decrypted value can travel with it.
 */
export class CredentialsUnreadableError extends Error {
  constructor() {
    super('The stored credentials cannot be read.');
    this.name = 'CredentialsUnreadableError';
  }
}
