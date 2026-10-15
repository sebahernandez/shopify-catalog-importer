import type { Store } from '../domain/store.js';
import type { CredentialProvider } from './credential-provider.port.js';

/** Hands out the credential provider of a store and drops it when its credentials change. */
export interface CredentialProviderRegistry {
  /** Throws `CredentialsUnreadableError` when the stored credentials cannot be read for this store. */
  forStore(record: Store): CredentialProvider;
  /** Drops any cached token of the store (credentials replaced or store deleted). */
  forget(storeId: string): void;
}
