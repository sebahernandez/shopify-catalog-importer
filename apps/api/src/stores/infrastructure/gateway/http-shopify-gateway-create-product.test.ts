import { describe, expect, it } from 'vitest';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import {
  createdProductBody,
  createdWithUserErrorBody,
  emptyProductSetBody,
  handleTakenBody,
  productSetNullBody,
  unknownMediaStatusBody,
} from '../../test-support/fixtures/product-set.js';
import { throttled200Body, invalidKey401Body } from '../../test-support/fixtures/error-bodies.js';
import { SAMPLE_PRODUCT } from '../../test-support/gateway-contract-suite.js';
import { connectionFor, gatewayOver, okStep } from '../../test-support/gateway-test-helpers.js';
import { PRODUCT_SET_OPERATION } from './graphql-operations.js';
import { productSetSchema } from './response-schemas.js';

const TOKEN = 'shpat_CANARY_CREATE_TOKEN';
const sent = (call: { body: unknown } | undefined) =>
  JSON.parse(call?.body as string) as {
    query: string;
    variables: { input: Record<string, unknown> };
  };
const conn = () => connectionFor('mystore.myshopify.com', TOKEN);

describe('createProduct request', () => {
  it('sends one productSet call with the exact ProductSetInput shape and the draft status', async () => {
    const { gateway, calls } = gatewayOver([okStep(createdProductBody)]);
    await gateway.createProduct(conn(), SAMPLE_PRODUCT);
    expect(calls).toHaveLength(1);
    const body = sent(calls[0]);
    expect(body.query).toBe(PRODUCT_SET_OPERATION.query);
    expect(body.variables).toEqual({
      input: {
        title: 'Camiseta',
        handle: 'camiseta',
        descriptionHtml: '<p>Hola</p>',
        vendor: 'Marca',
        productType: 'Ropa',
        tags: ['a', 'b'],
        status: 'DRAFT',
        productOptions: [{ name: 'Talla', values: [{ name: 'S' }] }],
        variants: [
          {
            optionValues: [{ optionName: 'Talla', name: 'S' }],
            price: '10.00',
            sku: 'SKU-1',
            inventoryItem: { tracked: true, sku: 'SKU-1' },
            inventoryQuantities: [
              { locationId: 'gid://shopify/Location/0001', name: 'available', quantity: 5 },
            ],
          },
        ],
        files: [{ originalSource: 'https://example.com/a.jpg', contentType: 'IMAGE', alt: 'Foto' }],
      },
    });
  });

  it('omits optional members that are absent and sends untracked variants without quantities', async () => {
    const { gateway, calls } = gatewayOver([okStep(createdProductBody)]);
    await gateway.createProduct(conn(), {
      title: 'T',
      handle: 'h',
      tags: [],
      options: [{ name: 'Title', values: ['Default Title'] }],
      variants: [
        {
          optionValues: [{ optionName: 'Title', name: 'Default Title' }],
          price: '1',
          compareAtPrice: '2',
          barcode: '123',
          sku: 'S',
          tracked: false,
        },
      ],
      images: [{ url: 'https://example.com/b.jpg' }],
    });
    const { input } = sent(calls[0]).variables;
    expect(input).not.toHaveProperty('descriptionHtml');
    expect(input).not.toHaveProperty('vendor');
    expect(input).not.toHaveProperty('productType');
    expect(input.files).toEqual([
      { originalSource: 'https://example.com/b.jpg', contentType: 'IMAGE' },
    ]);
    expect((input.variants as Record<string, unknown>[])[0]).toEqual({
      optionValues: [{ optionName: 'Title', name: 'Default Title' }],
      price: '1',
      compareAtPrice: '2',
      barcode: '123',
      sku: 'S',
      inventoryItem: { tracked: false, sku: 'S' },
    });
  });

  it('sends the token only in the access header, never in the body', async () => {
    const { gateway, calls } = gatewayOver([okStep(createdProductBody)]);
    await gateway.createProduct(conn(), SAMPLE_PRODUCT);
    expect(calls[0]?.headers['x-shopify-access-token']).toBe(TOKEN);
    expect(calls[0]?.body as string).not.toContain(TOKEN);
  });
});

describe('createProduct response', () => {
  it('maps an unknown media status to UNKNOWN', async () => {
    const { gateway } = gatewayOver([okStep(unknownMediaStatusBody)]);
    const read = await gateway.createProduct(conn(), SAMPLE_PRODUCT);
    expect(read.value).toMatchObject({ product: { media: [{ status: 'UNKNOWN' }] } });
  });

  it('keeps the non-blocking user errors of a created product, without their messages', async () => {
    const { gateway } = gatewayOver([okStep(createdWithUserErrorBody)]);
    const read = await gateway.createProduct(conn(), SAMPLE_PRODUCT);
    expect(read.value).toMatchObject({
      kind: 'created',
      userErrors: [{ field: null, code: null }],
    });
    expect(JSON.stringify(read.value)).not.toContain('Heads up');
  });

  it('never keeps the Shopify message of a rejection', async () => {
    const { gateway } = gatewayOver([okStep(handleTakenBody)]);
    const read = await gateway.createProduct(conn(), SAMPLE_PRODUCT);
    expect(JSON.stringify(read.value)).not.toContain('already been taken');
  });

  it.each([
    ['no product and no user errors', emptyProductSetBody],
    ['a null productSet', productSetNullBody],
    ['a data member of the wrong shape', { data: { productSet: { product: 5, userErrors: [] } } }],
  ])('fails with INVALID_RESPONSE on %s', async (_name, body) => {
    const { gateway } = gatewayOver([okStep(body)]);
    await expect(gateway.createProduct(conn(), SAMPLE_PRODUCT)).rejects.toMatchObject({
      kind: 'INVALID_RESPONSE',
    });
  });
});

describe('createProduct is never retried (design D15)', () => {
  const steps = [
    ['a 503', { status: 503, headers: { 'content-type': 'application/json' }, body: '{}' }],
    ['a 429', { status: 429, headers: { 'content-type': 'application/json' }, body: '{}' }],
    ['a THROTTLED body', okStep(throttled200Body)],
    ['a network failure', { throws: new TypeError('fetch failed') }],
    ['a timeout', { throws: new DOMException('timed out', 'TimeoutError') }],
  ] as const;

  it.each(steps)('sends exactly one request after %s', async (_name, step) => {
    const { gateway, calls } = gatewayOver([step, okStep(createdProductBody)]);
    await expect(gateway.createProduct(conn(), SAMPLE_PRODUCT)).rejects.toBeInstanceOf(
      ShopifyGatewayError,
    );
    expect(calls).toHaveLength(1);
  });

  it('resends once after a 401 only when the provider hands out a fresh token', async () => {
    const { gateway, calls } = gatewayOver([
      {
        status: 401,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(invalidKey401Body),
      },
      okStep(createdProductBody),
    ]);
    const connection = {
      ...conn(),
      credentials: {
        authKind: 'client_credentials' as const,
        accessToken: () => Promise.resolve('old-token-0001'),
        refreshAfterRejection: () => Promise.resolve('new-token-0002'),
      },
    };
    const read = await gateway.createProduct(connection, SAMPLE_PRODUCT);
    expect(read.value.kind).toBe('created');
    // A 401 means Shopify rejected the request before running it.
    expect(calls.map((call) => call.headers['x-shopify-access-token'])).toEqual([
      'old-token-0001',
      'new-token-0002',
    ]);
  });
});

describe('PRODUCT_SET_OPERATION', () => {
  it('is productSet in synchronous mode over the ProductSetInput variable', () => {
    expect(PRODUCT_SET_OPERATION.query).toContain(
      'mutation ProductSet($input: ProductSetInput!) { productSet(synchronous: true, input: $input)',
    );
    expect(PRODUCT_SET_OPERATION.query).toContain('userErrors { field message code }');
    expect(PRODUCT_SET_OPERATION.query).toContain('variants(first: 100) { nodes { id sku } }');
    expect(PRODUCT_SET_OPERATION.query).toContain('media(first: 20) { nodes { id status } }');
  });

  it('declares a hand-computed cost below the 1000 point cap and no API version', () => {
    expect(PRODUCT_SET_OPERATION.estimatedCost).toBe(140);
    expect(PRODUCT_SET_OPERATION.query).not.toMatch(/\b20\d\d-\d\d\b/);
  });
});

describe('productSetSchema', () => {
  it('parses the fixtures', () => {
    for (const body of [createdProductBody, handleTakenBody, createdWithUserErrorBody]) {
      expect(productSetSchema.safeParse(body.data).success).toBe(true);
    }
  });

  it('requires userErrors', () => {
    expect(productSetSchema.safeParse({ productSet: { product: null } }).success).toBe(false);
  });
});
