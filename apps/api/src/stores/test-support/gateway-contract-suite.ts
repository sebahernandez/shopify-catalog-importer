import { describe, expect, it } from 'vitest';
import { ShopifyGatewayError } from '../ports/shopify-gateway-error.js';
import type { ShopifyGateway, StoreConnection } from '../ports/shopify-gateway.port.js';
import {
  accessDenied200Body,
  htmlMaintenancePage,
  invalidKey401Body,
  throttled200Body,
} from './fixtures/error-bodies.js';
import { grantedScopesBody } from './fixtures/granted-scopes.js';
import { threeActiveBody } from './fixtures/locations.js';
import { healthyShopBody } from './fixtures/shop-info.js';
import { connectionFor } from './gateway-test-helpers.js';
import type { ScriptStep } from './scripted-fetch.js';

const HOST = 'mystore.myshopify.com';
const JSON_HEADERS = { 'content-type': 'application/json' };
const json = (body: unknown, status = 200): ScriptStep => ({
  status,
  headers: JSON_HEADERS,
  body: JSON.stringify(body),
});
const healthy = [json(healthyShopBody), json(grantedScopesBody), json(threeActiveBody)];
const repeat = (n: number, step: ScriptStep): ScriptStep[] => Array.from({ length: n }, () => step);

export type FailureKind =
  'SCOPE_MISSING' | 'AUTH_FAILED' | 'SERVER_ERROR' | 'NETWORK' | 'TIMEOUT' | 'INVALID_RESPONSE';

/** Each adapter turns a scenario into a gateway primed to behave as the scenario says. */
export interface ContractAdapter {
  /** True when the adapter retries retryable failures inside one call (the HTTP adapter does). */
  readonly retriesInternally: boolean;
  /** A gateway whose shop `mystore.myshopify.com` is healthy. */
  healthy(): ShopifyGateway;
  /** A gateway whose first read fails the way `kind` describes on every attempt. */
  failing(kind: FailureKind): ShopifyGateway;
  /** A gateway whose first `getShopInfo` is throttled once, then everything succeeds. */
  throttledOnce(): ShopifyGateway;
  /** Two shops, `alpha` and `beta`, with different names. */
  twoStores(): ShopifyGateway;
}

/** HTTP-side scripts per failure kind; the simulator side is a fault of the same kind. */
export const FAILURE_SCRIPTS: Record<FailureKind, ScriptStep[]> = {
  SCOPE_MISSING: [json(accessDenied200Body)],
  AUTH_FAILED: [json(invalidKey401Body, 401)],
  SERVER_ERROR: repeat(3, json({}, 503)),
  NETWORK: repeat(3, { throws: new TypeError('fetch failed') }),
  TIMEOUT: repeat(3, { throws: new DOMException('timed out', 'TimeoutError') }),
  INVALID_RESPONSE: [
    { status: 200, headers: { 'content-type': 'text/html' }, body: htmlMaintenancePage },
  ],
};
export const HEALTHY_SCRIPT = healthy;
export const THROTTLED_ONCE_SCRIPT: ScriptStep[] = [json(throttled200Body), ...healthy];

export const connectionOf = (host = HOST): StoreConnection => connectionFor(host, 'token');

/** Calls `read`, retrying only retryable errors, and reports how many failures were retried. */
export const retryOnRetryable = async <T>(
  read: () => Promise<T>,
  attempts = 3,
): Promise<{ value: T; failures: ShopifyGatewayError[] }> => {
  const failures: ShopifyGatewayError[] = [];
  for (let n = 1; ; n++) {
    try {
      return { value: await read(), failures };
    } catch (error) {
      if (!(error instanceof ShopifyGatewayError) || !error.retryable || n >= attempts) throw error;
      failures.push(error);
    }
  }
};

const readAll = async (gateway: ShopifyGateway, connection: StoreConnection) => ({
  shop: await retryOnRetryable(() => gateway.getShopInfo(connection)),
  scopes: await retryOnRetryable(() => gateway.getGrantedScopes(connection)),
  locations: await retryOnRetryable(() => gateway.listLocations(connection)),
});
const valuesOf = async (gateway: ShopifyGateway, connection: StoreConnection) => {
  const all = await readAll(gateway, connection);
  return {
    shop: all.shop.value.value,
    scopes: all.scopes.value.value,
    locations: all.locations.value.value,
    failures: all.shop.failures,
  };
};

const EXPECTED_HEALTHY = {
  shop: {
    id: 'gid://shopify/Shop/1',
    name: 'My Store',
    myshopifyDomain: HOST,
    currencyCode: 'USD',
    planName: 'Basic',
    shopifyPlus: false,
    partnerDevelopment: false,
  },
  scopes: ['write_products', 'read_locations'],
  locations: { truncated: false, locations: threeActiveBody.data.locations.nodes },
};

const FAILURE_KINDS: FailureKind[] = [
  'SCOPE_MISSING',
  'AUTH_FAILED',
  'SERVER_ERROR',
  'NETWORK',
  'TIMEOUT',
  'INVALID_RESPONSE',
];

/** One parameterized suite: the same values and the same error kinds for every adapter. */
export const runGatewayContractSuite = (name: string, adapter: ContractAdapter): void => {
  describe(`gateway contract: ${name}`, () => {
    it('healthy shop: shop info, scopes and locations are equal', async () => {
      const { failures, ...values } = await valuesOf(adapter.healthy(), connectionOf());
      expect(values).toEqual(EXPECTED_HEALTHY);
      expect(failures).toEqual([]);
    });

    it.each(FAILURE_KINDS)('failure %s throws that kind', async (kind) => {
      const gateway = adapter.failing(kind);
      const error: unknown = await gateway.getShopInfo(connectionOf()).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ShopifyGatewayError);
      expect((error as ShopifyGatewayError).kind).toBe(kind);
    });

    it('throttled first attempt then success ends with the same value', async () => {
      const { failures, ...values } = await valuesOf(adapter.throttledOnce(), connectionOf());
      expect(values).toEqual(EXPECTED_HEALTHY);
      if (adapter.retriesInternally) {
        expect(failures).toEqual([]);
      } else {
        expect(failures.map((f) => [f.kind, f.retryable])).toEqual([['THROTTLED', true]]);
      }
    });

    it('two stores at once each get their own result', async () => {
      const gateway = adapter.twoStores();
      const [alpha, beta] = await Promise.all([
        valuesOf(gateway, connectionOf('alpha.myshopify.com')),
        valuesOf(gateway, connectionOf('beta.myshopify.com')),
      ]);
      expect([alpha.shop.name, beta.shop.name]).toEqual(['Alpha Store', 'Beta Store']);
      expect([alpha.shop.myshopifyDomain, beta.shop.myshopifyDomain]).toEqual([
        'alpha.myshopify.com',
        'beta.myshopify.com',
      ]);
    });
  });
};
