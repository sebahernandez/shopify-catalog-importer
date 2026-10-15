import { describe, expect, it } from 'vitest';
import type { CredentialsPayload } from './credentials-payload.js';
import { newStore, replaceCredentials } from './store-rules.js';
import type { ShopDomain } from './shop-domain.js';

const NEW = {
  id: 'id-1',
  displayName: 'Demo',
  shopDomain: 'demo.myshopify.com' as ShopDomain,
  authKind: 'static_token',
  credentialsEnvelope: 'sb1.first',
} as const;

const verified = {
  ...newStore(NEW, '2026-01-01T00:00:00.000Z'),
  status: 'CONNECTED',
  shopifyShopId: 'gid://shopify/Shop/1',
  apiVersion: '2026-10',
  lastVerifiedAt: '2026-01-02T00:00:00.000Z',
  lastVerification: null,
} as const;

describe('store rules', () => {
  it('creates an UNVERIFIED store with empty verification and equal timestamps', () => {
    const store = newStore(NEW, '2026-01-01T00:00:00.000Z');
    expect(store.status).toBe('UNVERIFIED');
    expect([store.shopifyShopId, store.apiVersion, store.lastVerifiedAt]).toEqual([
      null,
      null,
      null,
    ]);
    expect(store.lastVerification).toBeNull();
    expect(store.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(store.updatedAt).toBe(store.createdAt);
  });

  it('resets verification on replace, keeps identity and may change authKind', () => {
    const next = replaceCredentials(
      verified,
      { authKind: 'client_credentials', credentialsEnvelope: 'sb1.second' },
      '2026-01-03T00:00:00.000Z',
    );
    expect(next).toMatchObject({
      status: 'UNVERIFIED',
      shopifyShopId: null,
      apiVersion: null,
      lastVerifiedAt: null,
      lastVerification: null,
      authKind: 'client_credentials',
      credentialsEnvelope: 'sb1.second',
      id: 'id-1',
      displayName: 'Demo',
      shopDomain: 'demo.myshopify.com',
      createdAt: verified.createdAt,
      updatedAt: '2026-01-03T00:00:00.000Z',
    });
  });

  it('never moves updatedAt earlier', () => {
    const older = replaceCredentials(verified, NEW, '2025-12-31T00:00:00.000Z');
    expect(older.updatedAt).toBe(verified.updatedAt);
  });

  it('discriminates credential payloads by kind', () => {
    const payload: CredentialsPayload = {
      kind: 'client_credentials',
      clientId: 'a',
      clientSecret: 'b',
    };
    if (payload.kind === 'client_credentials') expect(payload.clientId).toBe('a');
    expect(payload.kind).not.toBe('static_token');
  });
});
