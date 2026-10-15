import type { AuthKind, StoreStatus, VerificationSnapshot } from '@importer/contracts';
import type { ShopDomain } from './shop-domain.js';

/** A registered store. Timestamps are ISO 8601 UTC strings. */
export interface Store {
  readonly id: string;
  readonly displayName: string;
  readonly shopDomain: ShopDomain;
  readonly shopifyShopId: string | null;
  readonly apiVersion: string | null;
  readonly authKind: AuthKind;
  readonly credentialsEnvelope: string;
  readonly status: StoreStatus;
  readonly lastVerifiedAt: string | null;
  readonly lastVerification: VerificationSnapshot | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
