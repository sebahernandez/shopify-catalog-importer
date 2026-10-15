import type { AuthKind } from '@importer/contracts';
import type { ShopDomain } from './shop-domain.js';
import type { Store } from './store.js';

export interface NewStoreInput {
  readonly id: string;
  readonly displayName: string;
  readonly shopDomain: ShopDomain;
  readonly authKind: AuthKind;
  readonly credentialsEnvelope: string;
}

/** A new store starts UNVERIFIED with no verification data (create is offline). */
export const newStore = (input: NewStoreInput, nowIso: string): Store => ({
  ...input,
  shopifyShopId: null,
  apiVersion: null,
  status: 'UNVERIFIED',
  lastVerifiedAt: null,
  lastVerification: null,
  createdAt: nowIso,
  updatedAt: nowIso,
});

/** New credentials reset the verification; `updatedAt` never moves earlier. */
export const replaceCredentials = (
  store: Store,
  next: { readonly authKind: AuthKind; readonly credentialsEnvelope: string },
  nowIso: string,
): Store => ({
  ...store,
  ...next,
  shopifyShopId: null,
  apiVersion: null,
  status: 'UNVERIFIED',
  lastVerifiedAt: null,
  lastVerification: null,
  updatedAt: nowIso > store.updatedAt ? nowIso : store.updatedAt,
});
