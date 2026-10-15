import { describe, expect, it } from 'vitest';
import { parseShopDomain } from '../../domain/shop-domain.js';
import type { CredentialProvider } from '../../ports/credential-provider.port.js';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import type { StoreConnection } from '../../ports/shopify-gateway.port.js';
import { SimulatedShopifyGateway } from './simulated-shopify-gateway.js';
import type { SimulatorOperation } from './simulated-shopify-gateway.js';

const parsed = parseShopDomain('acme.myshopify.com');
if (!parsed.ok) throw new Error('bad fixture domain');
const connection = (apiVersion = '2026-04'): StoreConnection => ({
  storeId: 'store-1',
  shopDomain: parsed.domain,
  apiVersion,
  credentials: { authKind: 'static_token' } as unknown as CredentialProvider,
});
const simulator = (): SimulatedShopifyGateway => {
  const gateway = new SimulatedShopifyGateway();
  gateway.addShop(parsed.domain, {
    name: 'Acme',
    currencyCode: 'EUR',
    planName: 'Basic',
    shopifyPlus: false,
    partnerDevelopment: false,
    scopes: ['read_products'],
    locations: [],
  });
  return gateway;
};
const invoke = (gateway: SimulatedShopifyGateway, operation: SimulatorOperation) =>
  gateway[operation](connection());

describe('SimulatedShopifyGateway faults', () => {
  it('throttles call 2 of getShopInfo only', async () => {
    const gateway = simulator();
    gateway.faults.on('getShopInfo', 2, { kind: 'THROTTLED', retryAfterMs: 1500 });
    await expect(gateway.getShopInfo(connection())).resolves.toBeDefined();
    await expect(gateway.getShopInfo(connection())).rejects.toMatchObject({
      kind: 'THROTTLED',
      retryAfterMs: 1500,
      retryable: true,
    });
    await expect(gateway.getShopInfo(connection())).resolves.toBeDefined();
  });

  it('counts calls per operation, so another operation is unaffected', async () => {
    const gateway = simulator();
    gateway.faults.on('getGrantedScopes', 1, { kind: 'NETWORK' });
    await expect(gateway.getShopInfo(connection())).resolves.toBeDefined();
    await expect(gateway.getGrantedScopes(connection())).rejects.toMatchObject({ kind: 'NETWORK' });
  });

  it.each([
    'AUTH_FAILED',
    'SCOPE_MISSING',
    'THROTTLED',
    'NETWORK',
    'TIMEOUT',
    'SERVER_ERROR',
    'INVALID_RESPONSE',
  ] as const)('throws a %s ShopifyGatewayError on every operation', async (kind) => {
    for (const operation of ['getShopInfo', 'getGrantedScopes', 'listLocations'] as const) {
      const gateway = simulator();
      gateway.faults.on(operation, 1, { kind });
      const failure: unknown = await invoke(gateway, operation).catch((e: unknown) => e);
      expect(failure).toBeInstanceOf(ShopifyGatewayError);
      expect(failure).toMatchObject({ kind });
    }
  });

  it('fails every call of an operation with always()', async () => {
    const gateway = simulator();
    gateway.faults.always('listLocations', { kind: 'SERVER_ERROR' });
    for (let i = 0; i < 3; i += 1) {
      await expect(gateway.listLocations(connection())).rejects.toMatchObject({
        kind: 'SERVER_ERROR',
      });
    }
  });

  it('falls forward on VERSION_UNSUPPORTED: succeeds with a different version', async () => {
    const gateway = simulator();
    gateway.faults.on('getShopInfo', 1, { kind: 'VERSION_UNSUPPORTED' });
    const read = await gateway.getShopInfo(connection('2026-10'));
    expect(read.value.name).toBe('Acme');
    expect(read.apiVersionUsed).not.toBeNull();
    expect(read.apiVersionUsed).not.toBe('2026-10');
    await expect(gateway.getShopInfo(connection('2026-10'))).resolves.toMatchObject({
      apiVersionUsed: '2026-10',
    });
  });

  it('uses the version a fall-forward fault names', async () => {
    const gateway = simulator();
    gateway.faults.on('listLocations', 1, {
      kind: 'VERSION_UNSUPPORTED',
      apiVersionUsed: '2027-01',
    });
    await expect(gateway.listLocations(connection('2026-10'))).resolves.toMatchObject({
      apiVersionUsed: '2027-01',
    });
  });
});
