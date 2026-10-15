import type { ShopifyErrorKind, StoreStatus } from '@importer/contracts';

const AUTH_KINDS: readonly ShopifyErrorKind[] = ['AUTH_FAILED', 'CREDENTIAL_EXCHANGE_FAILED'];

/** Auth family outranks scope, which outranks any other problem; no problem is CONNECTED. */
export const statusFromProblems = (kinds: readonly ShopifyErrorKind[]): StoreStatus => {
  if (kinds.some((kind) => AUTH_KINDS.includes(kind))) return 'AUTH_FAILED';
  if (kinds.includes('SCOPE_MISSING')) return 'SCOPE_MISSING';
  return kinds.length === 0 ? 'CONNECTED' : 'UNAVAILABLE';
};
