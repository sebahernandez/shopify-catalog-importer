import { z } from 'zod';

/** Closed set of failure kinds a Shopify gateway or credential exchange can report. */
export const ShopifyErrorKind = z.enum([
  'AUTH_FAILED',
  'SCOPE_MISSING',
  'SHOP_UNAVAILABLE',
  'STORE_NOT_FOUND',
  'THROTTLED',
  'QUERY_TOO_COSTLY',
  'SERVER_ERROR',
  'VERSION_UNSUPPORTED',
  'NETWORK',
  'TIMEOUT',
  'INVALID_RESPONSE',
  'GRAPHQL_ERROR',
  'CREDENTIAL_EXCHANGE_FAILED',
]);

export type ShopifyErrorKind = z.infer<typeof ShopifyErrorKind>;

/** Why a client-credentials exchange failed. Only these two values; never response text. */
export const EXCHANGE_FAILURE_REASONS = z.enum(['SHOP_NOT_PERMITTED', 'UNKNOWN']);

export type ExchangeFailureReason = z.infer<typeof EXCHANGE_FAILURE_REASONS>;

const RETRYABLE: readonly ShopifyErrorKind[] = ['THROTTLED', 'SERVER_ERROR', 'NETWORK', 'TIMEOUT'];

/** True for the transient kinds a safe read may retry. */
export const isRetryableKind = (kind: ShopifyErrorKind): boolean => RETRYABLE.includes(kind);
