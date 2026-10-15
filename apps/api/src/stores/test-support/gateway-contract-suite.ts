import { describe, expect, it } from 'vitest';
import { ShopifyGatewayError } from '../ports/shopify-gateway-error.js';
import type {
  CreateProductInput,
  ShopifyGateway,
  StoreConnection,
} from '../ports/shopify-gateway.port.js';
import {
  accessDenied200Body,
  htmlMaintenancePage,
  invalidKey401Body,
  throttled200Body,
} from './fixtures/error-bodies.js';
import { grantedScopesBody } from './fixtures/granted-scopes.js';
import { threeActiveBody } from './fixtures/locations.js';
import { createdProductBody, handleTakenBody } from './fixtures/product-set.js';
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

/** The product the contract suite creates; one variant, one image. */
export const SAMPLE_PRODUCT: CreateProductInput = {
  title: 'Camiseta',
  handle: 'camiseta',
  descriptionHtml: '<p>Hola</p>',
  vendor: 'Marca',
  productType: 'Ropa',
  tags: ['a', 'b'],
  options: [{ name: 'Talla', values: ['S'] }],
  variants: [
    {
      optionValues: [{ optionName: 'Talla', name: 'S' }],
      price: '10.00',
      sku: 'SKU-1',
      tracked: true,
      inventory: { locationId: threeActiveBody.data.locations.nodes[0]?.id ?? '', quantity: 5 },
    },
  ],
  images: [{ url: 'https://example.com/a.jpg', alt: 'Foto' }],
};

export type FailureKind =
  'SCOPE_MISSING' | 'AUTH_FAILED' | 'SERVER_ERROR' | 'NETWORK' | 'TIMEOUT' | 'INVALID_RESPONSE';

/** Each adapter turns a scenario into a gateway primed to behave as the scenario says. */
export interface ContractAdapter {
  /** True when the adapter retries retryable failures inside one call (the HTTP adapter does). */
  readonly retriesInternally: boolean;
  /** A gateway whose shop `mystore.myshopify.com` is healthy. */
  healthy(): ShopifyGateway;
  /** A gateway whose first `operation` fails the way `kind` describes on every attempt. */
  failing(kind: FailureKind, operation?: 'getShopInfo' | 'createProduct'): ShopifyGateway;
  /** A healthy gateway where `SAMPLE_PRODUCT` can be created. */
  creating(): ShopifyGateway;
  /** A gateway where the handle of `SAMPLE_PRODUCT` is already taken. */
  creatingWithTakenHandle(): ShopifyGateway;
  /** A gateway whose first `createProduct` is throttled; a second call would succeed. */
  throttledCreate(): ShopifyGateway;
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
export const CREATE_PRODUCT_SCRIPT: ScriptStep[] = [json(createdProductBody)];
export const HANDLE_TAKEN_SCRIPT: ScriptStep[] = [json(handleTakenBody)];
export const THROTTLED_CREATE_SCRIPT: ScriptStep[] = [
  json(throttled200Body),
  json(createdProductBody),
];
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

    describe('createProduct', () => {
      it('creates the product and reports ids, the stored handle and media statuses', async () => {
        const read = await adapter.creating().createProduct(connectionOf(), SAMPLE_PRODUCT);
        expect(read.value).toEqual({
          kind: 'created',
          product: {
            id: 'gid://shopify/Product/1',
            handle: 'camiseta',
            variants: [{ id: 'gid://shopify/ProductVariant/1', sku: 'SKU-1' }],
            media: [{ id: 'gid://shopify/MediaImage/1', status: 'UPLOADED' }],
          },
          userErrors: [],
        });
      });

      it('answers a taken handle with a rejection, not an error', async () => {
        const read = await adapter
          .creatingWithTakenHandle()
          .createProduct(connectionOf(), SAMPLE_PRODUCT);
        expect(read.value).toEqual({
          kind: 'rejected',
          userErrors: [{ field: ['input', 'handle'], code: 'TAKEN' }],
        });
      });

      it.each(FAILURE_KINDS)('failure %s throws that kind', async (kind) => {
        const error: unknown = await adapter
          .failing(kind, 'createProduct')
          .createProduct(connectionOf(), SAMPLE_PRODUCT)
          .catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ShopifyGatewayError);
        expect((error as ShopifyGatewayError).kind).toBe(kind);
      });

      it('is never retried: a throttled first attempt is an error even though a second would pass', async () => {
        const error: unknown = await adapter
          .throttledCreate()
          .createProduct(connectionOf(), SAMPLE_PRODUCT)
          .catch((e: unknown) => e);
        expect(error).toBeInstanceOf(ShopifyGatewayError);
        expect((error as ShopifyGatewayError).kind).toBe('THROTTLED');
      });
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
