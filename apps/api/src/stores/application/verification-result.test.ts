import {
  REQUIRED_CAPABILITIES,
  StoreVerification,
  type ShopifyErrorKind,
} from '@importer/contracts';
import { describe, expect, it } from 'vitest';
import { assembleVerification, toSnapshot, type VerificationParts } from './verification-result.js';

const SHOP = {
  id: 'gid://shopify/Shop/1',
  name: 'Demo',
  myshopifyDomain: 'demo.myshopify.com',
  currencyCode: 'USD',
  planName: 'Basic',
  shopifyPlus: false,
  partnerDevelopment: false,
};
const LOCATION = {
  id: 'gid://shopify/Location/1',
  name: 'Warehouse A',
  isActive: true,
  fulfillsOnlineOrders: true,
};
const GRANTED = ['write_products', 'write_files', 'write_inventory'];
const base: VerificationParts = {
  checkedAt: '2026-10-15T10:00:00.000Z',
  requestedVersion: '2026-10',
  shop: SHOP,
  granted: GRANTED,
  locations: [LOCATION],
  locationsTruncated: false,
  versionsUsed: ['2026-10', '2026-10', '2026-10'],
  failure: null,
};
const run = (over: Partial<VerificationParts>) => assembleVerification({ ...base, ...over });

describe('assembleVerification', () => {
  it('is ok and CONNECTED without problems and parses as a StoreVerification', () => {
    const { result, status } = run({});
    expect(result.ok).toBe(true);
    expect(status).toBe('CONNECTED');
    expect(result.scopes.required).toEqual([...REQUIRED_CAPABILITIES]);
    expect(StoreVerification.safeParse(result).success).toBe(true);
  });

  it('gives a single SCOPE_MISSING problem with the diff', () => {
    const { result, status } = run({ granted: ['write_products', 'write_inventory'] });
    expect(result.problems).toEqual([
      { kind: 'SCOPE_MISSING', code: 'SCOPE_MISSING', params: { missing: ['write_files'] } },
    ]);
    expect(status).toBe('SCOPE_MISSING');
  });

  it('unions the diff with a listLocations scope denial into one problem', () => {
    const { result } = run({
      granted: ['write_products', 'write_inventory'],
      failure: { kind: 'SCOPE_MISSING', onLocations: true },
    });
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]?.params).toEqual({ missing: ['write_files', 'locations'] });
    expect(
      run({ failure: { kind: 'SCOPE_MISSING', onLocations: true } }).result.problems[0]?.params,
    ).toEqual({
      missing: ['locations'],
    });
  });

  it('keeps code equal to kind and carries the exchange reason only', () => {
    const exchange = run({
      failure: { kind: 'CREDENTIAL_EXCHANGE_FAILED', reason: 'SHOP_NOT_PERMITTED' },
      granted: null,
      shop: null,
    });
    expect(exchange.result.problems).toEqual([
      {
        kind: 'CREDENTIAL_EXCHANGE_FAILED',
        code: 'CREDENTIAL_EXCHANGE_FAILED',
        params: { reason: 'SHOP_NOT_PERMITTED' },
      },
    ]);
    expect(exchange.status).toBe('AUTH_FAILED');
    const unknown = run({ failure: { kind: 'CREDENTIAL_EXCHANGE_FAILED' }, granted: null });
    expect(unknown.result.problems[0]?.params).toEqual({ reason: 'UNKNOWN' });
    const timeout = run({ failure: { kind: 'TIMEOUT' }, granted: null });
    expect(timeout.result.problems).toEqual([{ kind: 'TIMEOUT', code: 'TIMEOUT', params: {} }]);
    expect(timeout.status).toBe('UNAVAILABLE');
  });

  it('maps unreadable credentials to AUTH_FAILED with its own code', () => {
    const { result, status } = run({
      failure: 'CREDENTIALS_UNREADABLE',
      shop: null,
      granted: null,
      locations: [],
      versionsUsed: [],
    });
    expect(result.problems).toEqual([
      { kind: 'AUTH_FAILED', code: 'CREDENTIALS_UNREADABLE', params: {} },
    ]);
    expect(status).toBe('AUTH_FAILED');
  });

  it('returns empty parts when scopes were not read: missing is the full list, no scope problem', () => {
    const { result } = run({
      shop: null,
      granted: null,
      locations: [],
      failure: { kind: 'AUTH_FAILED' },
    });
    expect(result.scopes).toEqual({
      granted: [],
      required: [...REQUIRED_CAPABILITIES],
      missing: [...REQUIRED_CAPABILITIES],
    });
    expect(result.problems.map((p) => p.kind)).toEqual(['AUTH_FAILED']);
    expect(result.shop).toBeNull();
  });

  it('adds a version mismatch for a differing used version only', () => {
    const forward = run({ versionsUsed: ['2026-10', '2027-01', '2026-10'] });
    expect(forward.result.apiVersion).toEqual({ requested: '2026-10', used: '2027-01' });
    expect(forward.result.problems).toEqual([
      {
        kind: 'VERSION_UNSUPPORTED',
        code: 'API_VERSION_MISMATCH',
        params: { requested: '2026-10', used: '2027-01' },
      },
    ]);
    expect(forward.status).toBe('UNAVAILABLE');
    const none = run({ versionsUsed: [null, null, null] });
    expect(none.result.apiVersion.used).toBeNull();
    expect(none.result.problems).toEqual([]);
    expect(run({}).result.apiVersion.used).toBe('2026-10');
  });

  it('ranks scope above a version problem', () => {
    const both = run({ granted: ['write_files'], versionsUsed: ['2027-01'] });
    expect(both.status).toBe('SCOPE_MISSING');
    expect(both.result.problems).toHaveLength(2);
  });

  it('holds only strings, numbers or string arrays in params, whatever the kind', () => {
    const kinds: ShopifyErrorKind[] = [
      'AUTH_FAILED',
      'SHOP_UNAVAILABLE',
      'THROTTLED',
      'GRAPHQL_ERROR',
      'NETWORK',
    ];
    for (const kind of kinds) {
      const { result } = run({ failure: { kind }, granted: null });
      for (const problem of result.problems) {
        for (const value of Object.values(problem.params)) {
          expect(['string', 'number', 'object']).toContain(typeof value);
        }
      }
    }
  });

  it('builds a snapshot with locationCount and no locations', () => {
    const snapshot = toSnapshot(
      run({ locations: [LOCATION, { ...LOCATION, id: 'x', name: 'B' }] }).result,
    );
    expect(snapshot.locationCount).toBe(2);
    expect(snapshot).not.toHaveProperty('locations');
    expect(JSON.stringify(snapshot)).not.toContain('Warehouse');
  });
});
