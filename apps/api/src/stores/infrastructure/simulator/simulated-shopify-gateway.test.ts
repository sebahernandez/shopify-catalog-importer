import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseShopDomain } from '../../domain/shop-domain.js';
import type { ShopDomain } from '../../domain/shop-domain.js';
import type { CredentialProvider } from '../../ports/credential-provider.port.js';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import type { Location, StoreConnection } from '../../ports/shopify-gateway.port.js';
import { SimulatedShopifyGateway } from './simulated-shopify-gateway.js';

const domainOf = (host: string): ShopDomain => {
  const parsed = parseShopDomain(host);
  if (!parsed.ok) throw new Error(`bad fixture domain ${host}`);
  return parsed.domain;
};
const credentials = { authKind: 'static_token' } as unknown as CredentialProvider;
const connect = (host: string, apiVersion = '2026-04'): StoreConnection => ({
  storeId: 'store-1',
  shopDomain: domainOf(host),
  apiVersion,
  credentials,
});
const location = (id: string, name: string, isActive = true): Location => ({
  id,
  name,
  isActive,
  fulfillsOnlineOrders: true,
});
const manyLocations = (count: number): Location[] =>
  Array.from({ length: count }, (_, i) => location(`gid://l/${i}`, `Place ${i}`));
const SHOP = 'acme.myshopify.com';

const withShop = (locations: Location[] = [], scopes: string[] = []) => {
  const gateway = new SimulatedShopifyGateway();
  gateway.addShop(domainOf(SHOP), {
    name: 'Acme',
    currencyCode: 'EUR',
    planName: 'Basic',
    shopifyPlus: true,
    partnerDevelopment: false,
    scopes,
    locations,
  });
  return gateway;
};

describe('SimulatedShopifyGateway', () => {
  it('returns the configured shop info with the requested version', async () => {
    const read = await withShop().getShopInfo(connect(SHOP));
    expect(read.apiVersionUsed).toBe('2026-04');
    expect(read.value).toMatchObject({
      name: 'Acme',
      myshopifyDomain: SHOP,
      currencyCode: 'EUR',
      planName: 'Basic',
      shopifyPlus: true,
      partnerDevelopment: false,
    });
  });

  it('keeps scopes unique in the order received', async () => {
    const gateway = withShop([], ['read_products', 'read_locations', 'read_products']);
    const read = await gateway.getGrantedScopes(connect(SHOP));
    expect(read.value).toEqual(['read_products', 'read_locations']);
  });

  it('fails every operation for an unknown domain with STORE_NOT_FOUND', async () => {
    const gateway = withShop();
    const ghost = connect('ghost.myshopify.com');
    for (const call of [
      () => gateway.getShopInfo(ghost),
      () => gateway.getGrantedScopes(ghost),
      () => gateway.listLocations(ghost),
    ]) {
      await expect(call()).rejects.toMatchObject({
        name: 'ShopifyGatewayError',
        kind: 'STORE_NOT_FOUND',
      });
    }
    await expect(gateway.getShopInfo(ghost)).rejects.toBeInstanceOf(ShopifyGatewayError);
  });

  it.each([
    [3, 3, false],
    [250, 250, false],
    [251, 250, true],
  ])('with %i active locations returns %i, truncated %s', async (count, size, truncated) => {
    const read = await withShop(manyLocations(count)).listLocations(connect(SHOP));
    expect(read.value.locations).toHaveLength(size);
    expect(read.value.truncated).toBe(truncated);
  });

  it('returns only active locations, ordered by name then id', async () => {
    const gateway = withShop([
      location('gid://l/9', 'Zeta'),
      location('gid://l/2', 'Alpha'),
      location('gid://l/5', 'Hidden', false),
      location('gid://l/1', 'Alpha'),
    ]);
    const read = await gateway.listLocations(connect(SHOP));
    expect(read.value.locations.map((l) => l.id)).toEqual(['gid://l/1', 'gid://l/2', 'gid://l/9']);
  });

  it('logs the operation order for tests', async () => {
    const gateway = withShop();
    await gateway.getGrantedScopes(connect(SHOP));
    await gateway.getShopInfo(connect(SHOP));
    await gateway.listLocations(connect(SHOP));
    expect(gateway.calls).toEqual(['getGrantedScopes', 'getShopInfo', 'listLocations']);
  });

  it('uses no timers, Math.random, Date or node: import in its sources', () => {
    for (const file of ['simulated-shopify-gateway.ts', 'simulator-faults.ts']) {
      const source = readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');
      expect(source).not.toMatch(/setTimeout|setInterval|setImmediate|Math\.random|Date|node:/);
    }
  });
});
