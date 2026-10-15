import { ShopifyErrorKind } from '@importer/contracts';
import { describe, expect, it, vi } from 'vitest';
import { ShopifyGatewayError } from '../ports/shopify-gateway-error.js';
import type { ShopifyGateway } from '../ports/shopify-gateway.port.js';
import {
  ALL_SCOPES,
  ID_1,
  STATIC,
  T0,
  domainOf,
  healthyShop,
  makeHarness,
  type Harness,
} from '../test-support/store-use-case-harness.js';
import { StoreNotFoundError } from './store-errors.js';
import { VerifyStoreConnectionUseCase } from './verify-store-connection.use-case.js';

const HOST = 'demo.myshopify.com';

async function setup(
  scopes: readonly string[] = ALL_SCOPES,
  options?: Parameters<typeof makeHarness>[0],
) {
  const h = makeHarness(options);
  const store = await h.addStore(ID_1, HOST, STATIC);
  h.simulator.addShop(domainOf(HOST), healthyShop(scopes));
  return { h, store, ...build(h, h.gateway) };
}
function build(h: Harness, gateway: ShopifyGateway, apiVersion = '2026-10') {
  const warn = vi.fn();
  const useCase = new VerifyStoreConnectionUseCase({
    repository: h.repository,
    registry: h.registry,
    gateway,
    clock: h.clock,
    apiVersion,
    logger: { warn } as never,
  });
  return { useCase, warn };
}

describe('VerifyStoreConnectionUseCase', () => {
  it('verifies a healthy store in call order with the configured version', async () => {
    const { h, useCase } = await setup();
    const result = await useCase.execute(ID_1);
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.locations).toHaveLength(2);
    expect(result.apiVersion).toEqual({ requested: '2026-10', used: '2026-10' });
    expect(result.scopes.required).toEqual([
      'write_products',
      'write_files',
      'write_inventory',
      'locations',
    ]);
    expect(h.simulator.calls).toEqual(['getShopInfo', 'getGrantedScopes', 'listLocations']);
  });

  it('ignores the stored version and replaces it with the result', async () => {
    const { h, useCase, store } = await setup();
    h.repository.rows.set(ID_1, { ...store, apiVersion: '2026-07' });
    await useCase.execute(ID_1);
    expect(h.repository.rows.get(ID_1)?.apiVersion).toBe('2026-10');
  });

  it('fails not found without outbound calls for an unknown or malformed id', async () => {
    const { h, useCase } = await setup();
    await expect(useCase.execute('33333333-3333-4333-8333-333333333333')).rejects.toBeInstanceOf(
      StoreNotFoundError,
    );
    await expect(useCase.execute('not-a-uuid')).rejects.toBeInstanceOf(StoreNotFoundError);
    expect(h.simulator.calls).toEqual([]);
  });

  it('reports one SCOPE_MISSING problem for a missing write scope', async () => {
    const { useCase } = await setup(['write_products', 'write_inventory']);
    const result = await useCase.execute(ID_1);
    expect(result.problems).toEqual([
      { kind: 'SCOPE_MISSING', code: 'SCOPE_MISSING', params: { missing: ['write_files'] } },
    ]);
    expect(result.ok).toBe(false);
  });

  it('adds locations to the problem when listLocations is denied but returns shop and granted', async () => {
    const { h, useCase } = await setup();
    h.simulator.faults.always('listLocations', { kind: 'SCOPE_MISSING' });
    const result = await useCase.execute(ID_1);
    expect(result.problems).toEqual([
      { kind: 'SCOPE_MISSING', code: 'SCOPE_MISSING', params: { missing: ['locations'] } },
    ]);
    expect(result.shop?.name).toBe('Demo');
    expect(result.scopes.granted).toEqual(ALL_SCOPES);
    expect(h.repository.rows.get(ID_1)?.status).toBe('SCOPE_MISSING');
  });

  it('reports an exchange refusal by reason only, without response text', async () => {
    const h = makeHarness({
      exchange: () =>
        Promise.reject(
          new ShopifyGatewayError('CREDENTIAL_EXCHANGE_FAILED', { reason: 'SHOP_NOT_PERMITTED' }),
        ),
    });
    await h.addStore(ID_1, HOST, {
      kind: 'client_credentials',
      clientId: 'client-id-0001',
      clientSecret: 'client-secret-0002',
    });
    h.simulator.addShop(domainOf(HOST), healthyShop(ALL_SCOPES));
    const result = await build(h, h.gateway).useCase.execute(ID_1);
    expect(result.problems).toEqual([
      {
        kind: 'CREDENTIAL_EXCHANGE_FAILED',
        code: 'CREDENTIAL_EXCHANGE_FAILED',
        params: { reason: 'SHOP_NOT_PERMITTED' },
      },
    ]);
    expect(h.repository.rows.get(ID_1)?.status).toBe('AUTH_FAILED');
    expect(JSON.stringify(result)).not.toMatch(/client-secret|exchange failed/i);
  });

  it('makes no outbound call for an unreadable envelope', async () => {
    const { h, useCase, store } = await setup();
    h.repository.rows.set(ID_1, { ...store, credentialsEnvelope: 'sb1.garbage' });
    const result = await useCase.execute(ID_1);
    expect(h.simulator.calls).toEqual([]);
    expect(result.problems).toEqual([
      { kind: 'AUTH_FAILED', code: 'CREDENTIALS_UNREADABLE', params: {} },
    ]);
  });

  it('stops after AUTH_FAILED on the first call with empty parts', async () => {
    const { h, useCase } = await setup();
    h.simulator.faults.always('getShopInfo', { kind: 'AUTH_FAILED' });
    const result = await useCase.execute(ID_1);
    expect(h.simulator.calls).toEqual(['getShopInfo']);
    expect(result.shop).toBeNull();
    expect(result.scopes).toMatchObject({
      granted: [],
      missing: ['write_products', 'write_files', 'write_inventory', 'locations'],
    });
    expect(result.locations).toEqual([]);
    expect(result.problems.map((p) => p.kind)).toEqual(['AUTH_FAILED']);
  });

  it('keeps the shop when the second call fails and never calls listLocations', async () => {
    const { h, useCase } = await setup();
    h.simulator.faults.always('getGrantedScopes', { kind: 'SERVER_ERROR' });
    const result = await useCase.execute(ID_1);
    expect(result.shop?.id).toContain('gid://shopify/Shop/');
    expect(h.simulator.calls).toEqual(['getShopInfo', 'getGrantedScopes']);
    expect(result.problems.map((p) => p.kind)).toEqual(['SERVER_ERROR']);
  });

  it.each(ShopifyErrorKind.options)('returns ok false and does not throw for %s', async (kind) => {
    const h = makeHarness();
    await h.addStore(ID_1, HOST, STATIC);
    const throwing = (): Promise<never> => Promise.reject(new ShopifyGatewayError(kind));
    const gateway: ShopifyGateway = {
      getShopInfo: throwing,
      getGrantedScopes: throwing,
      listLocations: throwing,
    };
    const result = await build(h, gateway).useCase.execute(ID_1);
    expect(result.ok).toBe(false);
    expect(result.problems.length).toBeGreaterThan(0);
  });

  it('reports a version fall-forward and records it; a matching header is clean', async () => {
    const { h, useCase } = await setup();
    h.simulator.faults.always('getShopInfo', {
      kind: 'VERSION_UNSUPPORTED',
      apiVersionUsed: '2027-01',
    });
    const result = await useCase.execute(ID_1);
    expect(result.problems.map((p) => p.code)).toEqual(['API_VERSION_MISMATCH']);
    expect(h.repository.rows.get(ID_1)?.apiVersion).toBe('2027-01');
  });

  it('persists the mapped status and the injected checkedAt, touching nothing else', async () => {
    const { h, useCase, store } = await setup();
    const result = await useCase.execute(ID_1);
    expect(result.checkedAt).toBe(T0);
    const row = h.repository.rows.get(ID_1);
    expect(row).toMatchObject({
      status: 'CONNECTED',
      lastVerifiedAt: T0,
      shopDomain: store.shopDomain,
      displayName: store.displayName,
      credentialsEnvelope: store.credentialsEnvelope,
    });
    expect(row?.lastVerification).toMatchObject({ locationCount: 2 });
    expect(JSON.stringify(row?.lastVerification)).not.toMatch(/"locations":|Location\/1/);
  });

  it('returns but does not persist when credentials changed during the call, and logs field names only', async () => {
    const { h, useCase, store, warn } = await setup();
    h.simulator.faults.always('listLocations', { kind: 'NETWORK' });
    const original = h.simulator.listLocations.bind(h.simulator);
    h.simulator.listLocations = async (c) => {
      h.repository.rows.set(ID_1, { ...store, credentialsEnvelope: 'env-replaced' });
      return original(c);
    };
    const result = await useCase.execute(ID_1);
    expect(result.ok).toBe(false);
    expect(h.repository.rows.get(ID_1)?.status).toBe('UNVERIFIED');
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain('store_verification_discarded');
    expect(logged).not.toMatch(/env-replaced|static-token-canary|demo\.myshopify/);
  });

  it('never leaks the token into the result', async () => {
    const { useCase } = await setup();
    expect(JSON.stringify(await useCase.execute(ID_1))).not.toContain('static-token-canary');
  });
});
