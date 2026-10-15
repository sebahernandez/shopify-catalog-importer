import { describe, expect, it } from 'vitest';
import { CreateStoreBody, ReplaceCredentialsBody, STORE_STATUSES, StoreSummary } from './stores.js';

const credentials = { kind: 'static_token', accessToken: 'abcdefgh' };
const create = { displayName: 'Demo', domain: 'demo', credentials };
const summary = {
  id: '3f6c1c52-8f0e-4c53-a4a6-7c1c9f1a2b3d',
  displayName: 'Demo',
  shopDomain: 'demo.myshopify.com',
  shopifyShopId: null,
  apiVersion: null,
  authKind: 'static_token',
  status: 'UNVERIFIED',
  hasCredentials: true,
  lastVerifiedAt: null,
  lastVerification: null,
  createdAt: '2026-10-14T12:00:00.000Z',
  updatedAt: '2026-10-14T12:00:00.000Z',
};

describe('CreateStoreBody', () => {
  it('accepts exactly displayName, domain and credentials', () => {
    expect(CreateStoreBody.parse(create)).toEqual(create);
  });

  it.each([
    ['an id field', { ...create, id: summary.id }],
    ['an extra field', { ...create, extra: 1 }],
    ['a missing displayName', { domain: 'demo', credentials }],
    ['a missing domain', { displayName: 'Demo', credentials }],
    ['a missing credentials', { displayName: 'Demo', domain: 'demo' }],
    ['an empty displayName', { ...create, displayName: '' }],
    ['a whitespace only displayName', { ...create, displayName: ' \n ' }],
    ['an 81 character displayName', { ...create, displayName: 'x'.repeat(81) }],
  ])('rejects %s', (_label, value) => {
    expect(CreateStoreBody.safeParse(value).success).toBe(false);
  });

  it('trims displayName and counts code points', () => {
    expect(CreateStoreBody.parse({ ...create, displayName: ' Demo ' }).displayName).toBe('Demo');
    expect(CreateStoreBody.safeParse({ ...create, displayName: 'x' }).success).toBe(true);
    expect(CreateStoreBody.safeParse({ ...create, displayName: '😀'.repeat(80) }).success).toBe(
      true,
    );
    expect(CreateStoreBody.safeParse({ ...create, displayName: '😀'.repeat(81) }).success).toBe(
      false,
    );
  });
});

describe('ReplaceCredentialsBody', () => {
  it('is exactly credentials', () => {
    expect(ReplaceCredentialsBody.parse({ credentials })).toEqual({ credentials });
    expect(ReplaceCredentialsBody.safeParse({ credentials, extra: 1 }).success).toBe(false);
    expect(ReplaceCredentialsBody.safeParse({}).success).toBe(false);
  });
});

describe('StoreSummary', () => {
  it('has exactly the 12 listed fields', () => {
    expect(Object.keys(StoreSummary.parse(summary)).sort()).toEqual(Object.keys(summary).sort());
    expect(Object.keys(summary)).toHaveLength(12);
    expect(StoreSummary.safeParse({ ...summary, extra: 1 }).success).toBe(false);
  });

  it('limits status to the five values', () => {
    expect(STORE_STATUSES.options).toEqual([
      'UNVERIFIED',
      'CONNECTED',
      'AUTH_FAILED',
      'SCOPE_MISSING',
      'UNAVAILABLE',
    ]);
    expect(StoreSummary.safeParse({ ...summary, status: 'DELETED' }).success).toBe(false);
  });

  it.each([
    ['a non UUID id', { id: 'abc' }],
    ['a non ISO createdAt', { createdAt: 'yesterday' }],
    ['an offset timestamp', { updatedAt: '2026-10-14T12:00:00+02:00' }],
    ['an unknown authKind', { authKind: 'oauth' }],
  ])('rejects %s', (_label, patch) => {
    expect(StoreSummary.safeParse({ ...summary, ...patch }).success).toBe(false);
  });
});
