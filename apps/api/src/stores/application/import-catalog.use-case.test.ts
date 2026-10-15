import type { StoreStatus, ValidationReport } from '@importer/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { ImportableCatalog } from '../domain/importable-catalog.js';
import type { ShopifyGateway } from '../ports/shopify-gateway.port.js';
import type { WorkbookValidator } from '../ports/workbook-validator.port.js';
import {
  draftImage,
  draftOf,
  draftProduct,
  draftVariant,
  validReport,
} from '../test-support/import-draft-builders.js';
import {
  ALL_SCOPES,
  healthyShop,
  ID_1,
  makeHarness,
  STATIC,
  type Harness,
} from '../test-support/store-use-case-harness.js';
import { ImportCatalogUseCase } from './import-catalog.use-case.js';
import {
  ShopifyRequestFailedError,
  StoreNotConnectedError,
  StoreNotFoundError,
  WorkbookInvalidError,
} from './store-errors.js';

const HOST = 'demo.myshopify.com';
const BYTES = new Uint8Array([1, 2, 3]);
const HASH = 'b'.repeat(64);

const invalidReport: ValidationReport = {
  ...validReport,
  valid: false,
  summary: { errorCount: 1, warningCount: 0 },
  issues: [],
};

const tracked = (quantity: number, location: string | undefined) => ({
  tracked: true,
  quantity,
  location,
});

async function setup(
  draft: ImportableCatalog | undefined,
  options: { status?: StoreStatus; gateway?: (h: Harness) => ShopifyGateway } = {},
) {
  const h = makeHarness();
  const store = await h.addStore(ID_1, HOST, STATIC);
  h.repository.rows.set(ID_1, { ...store, status: options.status ?? 'CONNECTED' });
  h.simulator.addShop(store.shopDomain, healthyShop(ALL_SCOPES));
  const validate = vi.fn<WorkbookValidator['validate']>(() =>
    Promise.resolve(
      draft === undefined ? { report: invalidReport } : { report: validReport, draft },
    ),
  );
  const logger = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const useCase = new ImportCatalogUseCase({
    repository: h.repository,
    registry: h.registry,
    gateway: options.gateway?.(h) ?? h.gateway,
    validator: { validate },
    apiVersion: '2026-10',
    logger: logger as never,
  });
  return { h, useCase, validate, logger, domain: store.shopDomain };
}

describe('preconditions', () => {
  it.each(['not-an-id', '99999999-9999-4999-8999-999999999999'])(
    'answers %s as an unknown store before validating or calling Shopify',
    async (id) => {
      const { h, useCase, validate } = await setup(draftOf(draftProduct('P1')));
      await expect(useCase.execute(id, BYTES, HASH)).rejects.toBeInstanceOf(StoreNotFoundError);
      expect(validate).not.toHaveBeenCalled();
      expect(h.simulator.calls).toEqual([]);
    },
  );

  it.each(['UNVERIFIED', 'AUTH_FAILED', 'SCOPE_MISSING', 'UNAVAILABLE'] as const)(
    'refuses a %s store before validating, reading credentials or calling Shopify',
    async (status) => {
      const { h, useCase, validate } = await setup(draftOf(draftProduct('P1')), { status });
      await expect(useCase.execute(ID_1, BYTES, HASH)).rejects.toBeInstanceOf(
        StoreNotConnectedError,
      );
      expect(validate).not.toHaveBeenCalled();
      expect(h.simulator.calls).toEqual([]);
      expect(h.exchanged).toEqual([]);
    },
  );

  it('returns the report without calling Shopify when the workbook has errors', async () => {
    const { h, useCase, validate } = await setup(undefined);
    const error: unknown = await useCase.execute(ID_1, BYTES, HASH).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WorkbookInvalidError);
    expect((error as WorkbookInvalidError).report).toEqual(invalidReport);
    expect(validate).toHaveBeenCalledWith(BYTES, HASH);
    expect(h.simulator.calls).toEqual([]);
  });

  it('treats unreadable stored credentials as a store that is not connected', async () => {
    const { h, useCase } = await setup(draftOf(draftProduct('P1')));
    const store = h.repository.rows.get(ID_1)!;
    h.repository.rows.set(ID_1, { ...store, credentialsEnvelope: 'garbage' });
    await expect(useCase.execute(ID_1, BYTES, HASH)).rejects.toBeInstanceOf(StoreNotConnectedError);
    expect(h.simulator.calls).toEqual([]);
  });
});

describe('creating products', () => {
  it('creates every product in workbook order, one call each, and reports ids', async () => {
    const draft = draftOf(
      draftProduct('P1', { images: [draftImage(1)] }),
      draftProduct('P2'),
      draftProduct('P3'),
    );
    const { h, useCase, logger, domain } = await setup(draft);
    const response = await useCase.execute(ID_1, BYTES, HASH);
    expect(response.totals).toEqual({ products: 3, created: 3, failed: 0 });
    expect(response.stoppedEarly).toBe(false);
    expect(response.results).toEqual([
      {
        productKey: 'P1',
        handle: 'handle-P1',
        status: 'created',
        productId: 'gid://shopify/Product/1',
        shopifyHandle: 'handle-P1',
        mediaStatuses: ['UPLOADED'],
        imagesSkipped: { localFile: 0, overLimit: 0 },
        warnings: [],
      },
      expect.objectContaining({ productKey: 'P2', productId: 'gid://shopify/Product/2' }),
      expect.objectContaining({ productKey: 'P3', productId: 'gid://shopify/Product/3' }),
    ]);
    expect(h.simulator.calls).toEqual(['createProduct', 'createProduct', 'createProduct']);
    expect(h.simulator.createdProducts(domain).map((p) => p.input.handle)).toEqual([
      'handle-P1',
      'handle-P2',
      'handle-P3',
    ]);
    expect(logger.log).toHaveBeenCalledWith({
      event: 'store_import_finished',
      storeId: ID_1,
      status: 'completed',
    });
  });

  it('does not list locations when no variant carries stock', async () => {
    const { h, useCase } = await setup(draftOf(draftProduct('P1')));
    await useCase.execute(ID_1, BYTES, HASH);
    expect(h.simulator.calls).not.toContain('listLocations');
  });

  it('reports an empty workbook as zero products', async () => {
    const { useCase, h } = await setup(draftOf());
    expect(await useCase.execute(ID_1, BYTES, HASH)).toEqual({
      totals: { products: 0, created: 0, failed: 0 },
      stoppedEarly: false,
      results: [],
    });
    expect(h.simulator.calls).toEqual([]);
  });

  it('sends the configured API version, not the stored one', async () => {
    const seen: string[] = [];
    const { useCase } = await setup(draftOf(draftProduct('P1')), {
      gateway: (h) => ({
        getShopInfo: h.gateway.getShopInfo.bind(h.gateway),
        getGrantedScopes: h.gateway.getGrantedScopes.bind(h.gateway),
        listLocations: h.gateway.listLocations.bind(h.gateway),
        createProduct: (connection, input) => {
          seen.push(connection.apiVersion);
          return h.gateway.createProduct(connection, input);
        },
      }),
    });
    await useCase.execute(ID_1, BYTES, HASH);
    expect(seen).toEqual(['2026-10']);
  });

  it('counts local image files it cannot upload', async () => {
    const { useCase } = await setup(
      draftOf(draftProduct('P1', { images: [draftImage(1), draftImage(2, 'a/b.jpg', 'local')] })),
    );
    const { results } = await useCase.execute(ID_1, BYTES, HASH);
    expect(results[0]).toMatchObject({ status: 'created', imagesSkipped: { localFile: 1 } });
  });

  it('reports the handle Shopify stored when it differs from the requested one', async () => {
    const { useCase } = await setup(draftOf(draftProduct('P1')), {
      gateway: (h) => ({
        ...h.gateway,
        getShopInfo: h.gateway.getShopInfo.bind(h.gateway),
        getGrantedScopes: h.gateway.getGrantedScopes.bind(h.gateway),
        listLocations: h.gateway.listLocations.bind(h.gateway),
        createProduct: async (connection, input) => {
          const read = await h.gateway.createProduct(connection, input);
          return read.value.kind === 'created'
            ? {
                ...read,
                value: { ...read.value, product: { ...read.value.product, handle: 'handle-p1-1' } },
              }
            : read;
        },
      }),
    });
    const { results } = await useCase.execute(ID_1, BYTES, HASH);
    expect(results[0]).toMatchObject({ handle: 'handle-P1', shopifyHandle: 'handle-p1-1' });
  });
});

describe('locations', () => {
  const stocked = (key: string, location: string | undefined) =>
    draftProduct(key, {
      variants: [draftVariant(`SKU-${key}`, { inventory: tracked(5, location) })],
    });

  it('lists locations once and sends the id of the named location', async () => {
    const { h, useCase, domain } = await setup(draftOf(stocked('P1', 'A'), stocked('P2', 'b')));
    const { results } = await useCase.execute(ID_1, BYTES, HASH);
    expect(results.map(({ status }) => status)).toEqual(['created', 'created']);
    expect(h.simulator.calls.filter((call) => call === 'listLocations')).toHaveLength(1);
    const [first, second] = h.simulator.createdProducts(domain);
    expect(first?.input.variants[0]?.inventory).toEqual({
      locationId: 'gid://shopify/Location/2',
      quantity: 5,
    });
    expect(second?.input.variants[0]?.inventory?.locationId).toBe('gid://shopify/Location/1');
  });

  it('fails only the product whose location is unknown, ambiguous or missing', async () => {
    const { h, useCase } = await setup(
      draftOf(stocked('P1', 'Nowhere'), stocked('P2', undefined), stocked('P3', 'A')),
    );
    const response = await useCase.execute(ID_1, BYTES, HASH);
    expect(
      response.results.map((result) =>
        result.status === 'failed' ? result.failure.code : result.status,
      ),
    ).toEqual(['LOCATION_NOT_FOUND', 'LOCATION_REQUIRED', 'created']);
    expect(response.totals).toEqual({ products: 3, created: 1, failed: 2 });
    expect(response.stoppedEarly).toBe(false);
    expect(h.simulator.calls.filter((call) => call === 'createProduct')).toHaveLength(1);
  });

  it('uses the only active location for a variant without one', async () => {
    const { h, useCase, domain } = await setup(draftOf(stocked('P1', undefined)));
    h.simulator.addShop(domain, {
      ...healthyShop(ALL_SCOPES),
      locations: [
        {
          id: 'gid://shopify/Location/7',
          name: 'Solo',
          isActive: true,
          fulfillsOnlineOrders: true,
        },
        {
          id: 'gid://shopify/Location/8',
          name: 'Old',
          isActive: false,
          fulfillsOnlineOrders: true,
        },
      ],
    });
    const { results } = await useCase.execute(ID_1, BYTES, HASH);
    expect(results[0]?.status).toBe('created');
    expect(h.simulator.createdProducts(domain)[0]?.input.variants[0]?.inventory?.locationId).toBe(
      'gid://shopify/Location/7',
    );
  });

  it('does not echo the location name in the failure', async () => {
    const { useCase } = await setup(draftOf(stocked('P1', 'Secret Warehouse Name')));
    const response = await useCase.execute(ID_1, BYTES, HASH);
    expect(JSON.stringify(response)).not.toContain('Secret Warehouse Name');
  });

  it('throws a typed error and creates nothing when the locations cannot be read', async () => {
    const { h, useCase } = await setup(draftOf(stocked('P1', 'A')));
    h.simulator.faults.always('listLocations', { kind: 'AUTH_FAILED' });
    await expect(useCase.execute(ID_1, BYTES, HASH)).rejects.toBeInstanceOf(
      ShopifyRequestFailedError,
    );
    expect(h.simulator.calls).toEqual(['listLocations']);
  });
});

describe('per-product failures never abort the batch', () => {
  it('reports a taken handle as that product only', async () => {
    const { h, useCase } = await setup(
      draftOf(draftProduct('P1'), draftProduct('P2', { handle: 'handle-P1' }), draftProduct('P3')),
    );
    const response = await useCase.execute(ID_1, BYTES, HASH);
    expect(response.results.map(({ status }) => status)).toEqual(['created', 'failed', 'created']);
    expect(response.results[1]).toMatchObject({
      productKey: 'P2',
      failure: {
        code: 'HANDLE_TAKEN',
        details: [{ field: 'input.handle', code: 'TAKEN' }],
      },
    });
    expect(response.totals).toEqual({ products: 3, created: 2, failed: 1 });
    expect(h.simulator.calls).toHaveLength(3);
  });

  it('fails a product over the variant limit without calling Shopify for it', async () => {
    const many = Array.from({ length: 2049 }, (_, index) => draftVariant(`S${index}`));
    const { h, useCase } = await setup(
      draftOf(draftProduct('P1', { variants: many }), draftProduct('P2')),
    );
    const { results } = await useCase.execute(ID_1, BYTES, HASH);
    expect(results[0]).toMatchObject({ status: 'failed', failure: { code: 'TOO_MANY_VARIANTS' } });
    expect(results[1]?.status).toBe('created');
    expect(h.simulator.calls).toEqual(['createProduct']);
  });

  it('keeps going after a GraphQL error on one product', async () => {
    const { h, useCase } = await setup(draftOf(draftProduct('P1'), draftProduct('P2')));
    h.simulator.faults.on('createProduct', 1, { kind: 'INVALID_RESPONSE' });
    const { results } = await useCase.execute(ID_1, BYTES, HASH);
    expect(results.map(({ status }) => status)).toEqual(['failed', 'failed']);
  });
});

describe('errors that affect every product stop the run', () => {
  const draft = () => draftOf(draftProduct('P1'), draftProduct('P2'), draftProduct('P3'));

  it.each([
    ['AUTH_FAILED', 'STORE_ACCESS_FAILED'],
    ['SCOPE_MISSING', 'STORE_ACCESS_FAILED'],
    ['THROTTLED', 'THROTTLED'],
    ['NETWORK', 'OUTCOME_UNKNOWN'],
    ['TIMEOUT', 'OUTCOME_UNKNOWN'],
    ['SERVER_ERROR', 'OUTCOME_UNKNOWN'],
    ['INVALID_RESPONSE', 'OUTCOME_UNKNOWN'],
  ] as const)('%s on the second product marks the rest NOT_ATTEMPTED', async (kind, code) => {
    const { h, useCase, logger } = await setup(draft());
    h.simulator.faults.on('createProduct', 2, { kind });
    const response = await useCase.execute(ID_1, BYTES, HASH);
    expect(
      response.results.map((r) => (r.status === 'failed' ? r.failure.code : r.status)),
    ).toEqual(['created', code, 'NOT_ATTEMPTED']);
    expect(response.stoppedEarly).toBe(true);
    expect(response.totals).toEqual({ products: 3, created: 1, failed: 2 });
    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({ status: 'stopped' }));
  });

  it('never repeats a write: each product is sent at most once even when it fails', async () => {
    const { h, useCase } = await setup(draft());
    h.simulator.faults.always('createProduct', { kind: 'SERVER_ERROR' });
    await useCase.execute(ID_1, BYTES, HASH);
    expect(h.simulator.calls).toEqual(['createProduct']);
  });

  it('describes an unexpected error as an unknown outcome and keeps the earlier results', async () => {
    let calls = 0;
    const { useCase } = await setup(draft(), {
      gateway: (h) => ({
        getShopInfo: h.gateway.getShopInfo.bind(h.gateway),
        getGrantedScopes: h.gateway.getGrantedScopes.bind(h.gateway),
        listLocations: h.gateway.listLocations.bind(h.gateway),
        createProduct: (connection, input) => {
          calls += 1;
          if (calls === 2) return Promise.reject(new TypeError('boom shpat_SECRET_VALUE_1234'));
          return h.gateway.createProduct(connection, input);
        },
      }),
    });
    const response = await useCase.execute(ID_1, BYTES, HASH);
    expect(response.results.map(({ status }) => status)).toEqual(['created', 'failed', 'failed']);
    expect(JSON.stringify(response)).not.toContain('SECRET');
    expect(calls).toBe(2);
  });
});

describe('no secret leaves the use case', () => {
  it('keeps the access token out of results and logs, also on failure', async () => {
    const { h, useCase, logger } = await setup(draftOf(draftProduct('P1'), draftProduct('P2')));
    h.simulator.faults.on('createProduct', 2, {
      kind: 'AUTH_FAILED',
    });
    const response = await useCase.execute(ID_1, BYTES, HASH);
    const everything = JSON.stringify([response, logger.log.mock.calls, logger.error.mock.calls]);
    expect(everything).not.toContain('static-token-canary-0001');
    expect(everything).not.toMatch(/shpat_|accessToken|token/i);
  });
});
