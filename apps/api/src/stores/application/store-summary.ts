import type { StoreSummary } from '@importer/contracts';
import type { Store } from '../domain/store.js';

/** The 12 fields the API shows; credentials appear only as the boolean `hasCredentials`. */
export const toStoreSummary = (store: Store): StoreSummary => ({
  id: store.id,
  displayName: store.displayName,
  shopDomain: store.shopDomain,
  shopifyShopId: store.shopifyShopId,
  apiVersion: store.apiVersion,
  authKind: store.authKind,
  status: store.status,
  hasCredentials: store.credentialsEnvelope !== '',
  lastVerifiedAt: store.lastVerifiedAt,
  lastVerification: store.lastVerification,
  createdAt: store.createdAt,
  updatedAt: store.updatedAt,
});
