import { describe, expect, it } from 'vitest';
import { parseShopDomain } from '../../domain/shop-domain.js';
import { threeActiveBody } from '../../test-support/fixtures/locations.js';
import { SAMPLE_PRODUCT } from '../../test-support/gateway-contract-suite.js';
import { connectionFor } from '../../test-support/gateway-test-helpers.js';
import { SimulatedShopifyGateway } from './simulated-shopify-gateway.js';

const HOST = 'mystore.myshopify.com';
const parsed = parseShopDomain(HOST);
if (!parsed.ok) throw new Error('fixture domain must parse');
const domain = parsed.domain;

const simulator = () => {
  const gateway = new SimulatedShopifyGateway();
  gateway.addShop(domain, {
    name: 'My Store',
    currencyCode: 'USD',
    planName: 'Basic',
    shopifyPlus: false,
    partnerDevelopment: false,
    scopes: ['write_products'],
    locations: threeActiveBody.data.locations.nodes,
  });
  return gateway;
};
const conn = () => connectionFor(HOST, 'token-value-0001');

describe('SimulatedShopifyGateway.createProduct', () => {
  it('stores created products and numbers ids deterministically', async () => {
    const gateway = simulator();
    const first = await gateway.createProduct(conn(), SAMPLE_PRODUCT);
    const second = await gateway.createProduct(conn(), { ...SAMPLE_PRODUCT, handle: 'otra' });
    expect(first.value).toMatchObject({
      kind: 'created',
      product: { id: 'gid://shopify/Product/1' },
    });
    expect(second.value).toMatchObject({
      kind: 'created',
      product: {
        id: 'gid://shopify/Product/2',
        variants: [{ id: 'gid://shopify/ProductVariant/2' }],
      },
    });
    expect(gateway.createdProducts(domain).map((p) => p.input.handle)).toEqual([
      'camiseta',
      'otra',
    ]);
    expect(gateway.calls).toEqual(['createProduct', 'createProduct']);
  });

  it('rejects a repeated handle and stores nothing for it', async () => {
    const gateway = simulator();
    await gateway.createProduct(conn(), SAMPLE_PRODUCT);
    const again = await gateway.createProduct(conn(), SAMPLE_PRODUCT);
    expect(again.value).toEqual({
      kind: 'rejected',
      userErrors: [{ field: ['input', 'handle'], code: 'TAKEN' }],
    });
    expect(gateway.createdProducts(domain)).toHaveLength(1);
  });

  it('rejects a location that is not an active location of the shop', async () => {
    const gateway = simulator();
    const read = await gateway.createProduct(conn(), {
      ...SAMPLE_PRODUCT,
      variants: [
        {
          ...SAMPLE_PRODUCT.variants[0]!,
          inventory: { locationId: 'gid://shopify/Location/9999', quantity: 1 },
        },
      ],
    });
    expect(read.value).toMatchObject({
      kind: 'rejected',
      userErrors: [{ code: 'INVALID_INVENTORY_LOCATION' }],
    });
  });

  it('rejects two variants with the same option values', async () => {
    const gateway = simulator();
    const variant = SAMPLE_PRODUCT.variants[0]!;
    const read = await gateway.createProduct(conn(), {
      ...SAMPLE_PRODUCT,
      variants: [variant, { ...variant, sku: 'SKU-2' }],
    });
    expect(read.value).toMatchObject({
      kind: 'rejected',
      userErrors: [{ code: 'VARIANT_ALREADY_EXISTS' }],
    });
  });

  it('throws a scripted fault and an unknown shop', async () => {
    const gateway = simulator();
    gateway.faults.on('createProduct', 1, { kind: 'SERVER_ERROR' });
    await expect(gateway.createProduct(conn(), SAMPLE_PRODUCT)).rejects.toMatchObject({
      kind: 'SERVER_ERROR',
    });
    expect(gateway.createdProducts(domain)).toEqual([]);
    await expect(
      gateway.createProduct(
        connectionFor('other.myshopify.com', 'token-value-0001'),
        SAMPLE_PRODUCT,
      ),
    ).rejects.toMatchObject({ kind: 'STORE_NOT_FOUND' });
  });

  it('keeps products of different shops apart', async () => {
    const gateway = simulator();
    const other = parseShopDomain('other.myshopify.com');
    if (!other.ok) throw new Error('fixture domain must parse');
    gateway.addShop(other.domain, {
      name: 'Other',
      currencyCode: 'USD',
      planName: 'Basic',
      shopifyPlus: false,
      partnerDevelopment: false,
      scopes: [],
      locations: threeActiveBody.data.locations.nodes,
    });
    await gateway.createProduct(conn(), SAMPLE_PRODUCT);
    const read = await gateway.createProduct(
      connectionFor('other.myshopify.com', 'token-value-0001'),
      SAMPLE_PRODUCT,
    );
    expect(read.value.kind).toBe('created');
  });
});
