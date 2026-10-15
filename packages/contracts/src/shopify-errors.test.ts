import { describe, expect, it } from 'vitest';
import { EXCHANGE_FAILURE_REASONS, isRetryableKind, ShopifyErrorKind } from './shopify-errors.js';

const KINDS = [
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
] as const;

describe('shopify errors', () => {
  it('has exactly the 13 error kinds', () => {
    expect([...ShopifyErrorKind.options].sort()).toEqual([...KINDS].sort());
  });

  it('rejects an unknown kind', () => {
    expect(ShopifyErrorKind.safeParse('TEAPOT').success).toBe(false);
  });

  it.each(KINDS)('classifies %s as retryable only when transient', (kind) => {
    const transient = ['THROTTLED', 'SERVER_ERROR', 'NETWORK', 'TIMEOUT'];
    expect(isRetryableKind(kind)).toBe(transient.includes(kind));
  });

  it('lists the exchange failure reasons', () => {
    expect(EXCHANGE_FAILURE_REASONS.options).toEqual(['SHOP_NOT_PERMITTED', 'UNKNOWN']);
  });
});
