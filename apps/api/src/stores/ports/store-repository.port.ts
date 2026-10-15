import type { AuthKind, StoreStatus, VerificationSnapshot } from '@importer/contracts';
import type { Store } from '../domain/store.js';

/** Raised by `insert` when a store with the same canonical shop domain already exists. */
export class DuplicateShopDomainError extends Error {
  constructor() {
    super('A store with this shop domain already exists.');
    this.name = 'DuplicateShopDomainError';
  }
}

/** What one verification writes (design D19). */
export interface VerificationRecord {
  readonly status: StoreStatus;
  readonly lastVerifiedAt: string;
  /** The shop id when obtained, otherwise null and the stored value is kept. */
  readonly shopifyShopId: string | null;
  readonly apiVersion: string;
  readonly snapshot: VerificationSnapshot;
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
  /**
   * One conditional update `WHERE id = ? AND credentials_envelope = ?`. False when no row changed:
   * the credentials were replaced or the store deleted while the verification ran.
   */
  recordVerification(
    id: string,
    expectedEnvelope: string,
    record: VerificationRecord,
  ): Promise<boolean>;
  /** Hard delete; false when the id is unknown. */
  delete(id: string): Promise<boolean>;
}
