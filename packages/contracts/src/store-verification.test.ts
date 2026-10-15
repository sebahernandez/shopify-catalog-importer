import { describe, expect, it } from 'vitest';
import {
  StoreVerification,
  VerificationProblem,
  VerificationSnapshot,
} from './store-verification.js';

const base = {
  ok: true,
  checkedAt: '2026-10-14T12:00:00.000Z',
  shop: {
    id: 'gid://shopify/Shop/1',
    name: 'Demo',
    currencyCode: 'USD',
    planName: 'Basic',
    shopifyPlus: false,
    partnerDevelopment: false,
  },
  apiVersion: { requested: '2026-10', used: '2026-10' },
  scopes: {
    granted: ['write_products'],
    required: ['write_products', 'write_files', 'write_inventory', 'locations'],
    missing: [],
  },
  locationsTruncated: false,
  problems: [],
};
const locations = [
  { id: 'gid://shopify/Location/1', name: 'Main', isActive: true, fulfillsOnlineOrders: true },
];
const healthy = { ...base, locations };
const scopeProblem = {
  kind: 'SCOPE_MISSING',
  code: 'SCOPE_MISSING',
  params: { missing: ['write_files'] },
};
const snapshot = { ...base, locationCount: 1 };

describe('StoreVerification', () => {
  it('accepts a healthy result', () => {
    expect(StoreVerification.parse(healthy)).toEqual(healthy);
  });

  it('accepts a failed result with no shop and no version used', () => {
    const failed = {
      ...healthy,
      ok: false,
      shop: null,
      apiVersion: { requested: '2026-10', used: null },
      problems: [scopeProblem],
    };
    expect(StoreVerification.safeParse(failed).success).toBe(true);
  });

  it.each([
    ['ok true with problems', { ...healthy, problems: [scopeProblem] }],
    ['ok false without problems', { ...healthy, ok: false }],
    ['non ISO checkedAt', { ...healthy, checkedAt: 'yesterday' }],
    ['missing locationsTruncated', { ...healthy, locationsTruncated: undefined }],
  ])('rejects %s', (_label, value) => {
    expect(StoreVerification.safeParse(value).success).toBe(false);
  });
});

describe('VerificationProblem', () => {
  it('accepts string, number and string-array params', () => {
    const problem = { kind: 'THROTTLED', code: 'THROTTLED', params: { a: 'x', b: 2, c: ['y'] } };
    expect(VerificationProblem.safeParse(problem).success).toBe(true);
  });

  it.each([
    ['object value', { a: { b: 1 } }],
    ['boolean value', { a: true }],
    ['array of numbers', { a: [1] }],
  ])('rejects a params %s', (_label, params) => {
    expect(
      VerificationProblem.safeParse({ kind: 'THROTTLED', code: 'THROTTLED', params }).success,
    ).toBe(false);
  });

  it('accepts the two special codes with their kinds only', () => {
    const mismatch = {
      kind: 'VERSION_UNSUPPORTED',
      code: 'API_VERSION_MISMATCH',
      params: { requested: 'a', used: 'b' },
    };
    const unreadable = { kind: 'AUTH_FAILED', code: 'CREDENTIALS_UNREADABLE', params: {} };
    expect(VerificationProblem.safeParse(mismatch).success).toBe(true);
    expect(VerificationProblem.safeParse(unreadable).success).toBe(true);
    expect(VerificationProblem.safeParse({ ...unreadable, kind: 'NETWORK' }).success).toBe(false);
  });

  it('rejects a code that differs from its kind', () => {
    expect(
      VerificationProblem.safeParse({ kind: 'NETWORK', code: 'TIMEOUT', params: {} }).success,
    ).toBe(false);
  });
});

describe('VerificationSnapshot', () => {
  it('holds locationCount instead of locations', () => {
    expect(VerificationSnapshot.parse(snapshot)).toEqual(snapshot);
  });

  it('rejects a locations array and any location field', () => {
    expect(VerificationSnapshot.safeParse({ ...snapshot, locations }).success).toBe(false);
    expect(VerificationSnapshot.safeParse({ ...snapshot, locationName: 'Main' }).success).toBe(
      false,
    );
  });
});
