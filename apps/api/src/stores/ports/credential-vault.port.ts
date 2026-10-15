import type { AuthKind } from '@importer/contracts';
import type { CredentialsPayload } from '../domain/credentials-payload.js';

/** Encrypts a store's credentials for storage and reads them back, bound to that store. */
export interface CredentialVault {
  /** The envelope to store. Throws a `SecretBoxError` when the box cannot encrypt. */
  seal(storeId: string, payload: CredentialsPayload): string;
  /** Throws `CredentialsUnreadableError` when the envelope cannot be read for this store. */
  open(storeId: string, authKind: AuthKind, envelope: string): CredentialsPayload;
}
