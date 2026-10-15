import type { ShopifyErrorKind, StoreStatus } from '@importer/contracts';
import { describe, expect, it } from 'vitest';
import { statusFromProblems } from './verification-status.js';

const status = (...kinds: ShopifyErrorKind[]): StoreStatus => statusFromProblems(kinds);

describe('statusFromProblems', () => {
  it('is CONNECTED only without problems', () => {
    expect(status()).toBe('CONNECTED');
  });

  it.each(['AUTH_FAILED', 'CREDENTIAL_EXCHANGE_FAILED'] as const)(
    'maps %s to AUTH_FAILED',
    (kind) => {
      expect(status(kind)).toBe('AUTH_FAILED');
    },
  );

  it('maps SCOPE_MISSING over a version mismatch', () => {
    expect(status('SCOPE_MISSING', 'VERSION_UNSUPPORTED')).toBe('SCOPE_MISSING');
  });

  it.each([
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
  ] as const)('maps %s to UNAVAILABLE', (kind) => {
    expect(status(kind)).toBe('UNAVAILABLE');
  });

  it('ranks auth over scope over unavailable', () => {
    expect(status('NETWORK', 'SCOPE_MISSING', 'AUTH_FAILED')).toBe('AUTH_FAILED');
    expect(status('NETWORK', 'SCOPE_MISSING')).toBe('SCOPE_MISSING');
  });
});
