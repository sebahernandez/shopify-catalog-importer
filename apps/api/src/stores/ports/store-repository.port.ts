import type { AuthKind } from '@importer/contracts';
import type { Store } from '../domain/store.js';

/** Raised by `insert` when a store with the same canonical shop domain already exists. */
export class DuplicateShopDomainError extends Error {
  constructor() {
    super('A store with this shop domain already exists.');
    this.name = 'DuplicateShopDomainError';
  }
}

export interface StoreRepository {
  /** Persists a new store; throws `DuplicateShopDomainError` for a taken domain. */
  insert(store: Store): Promise<void>;
  findById(id: string): Promise<Store | null>;
  /** Oldest first (`createdAt`, then `id`). */
  list(): Promise<Store[]>;
  /** Replaces the credentials and resets the verification; null when the id is unknown. */
  replaceCredentials(
    id: string,
    next: { readonly authKind: AuthKind; readonly credentialsEnvelope: string },
  ): Promise<Store | null>;
  /** Hard delete; false when the id is unknown. */
  delete(id: string): Promise<boolean>;
}
