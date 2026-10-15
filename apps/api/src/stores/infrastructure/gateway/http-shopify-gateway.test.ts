import { describe, expect, it, vi } from 'vitest';
import { grantedScopesBody } from '../../test-support/fixtures/granted-scopes.js';
import {
  healthyShopBody,
  shopMissingCurrencyBody,
  shopNumericIdBody,
} from '../../test-support/fixtures/shop-info.js';
import { connectionFor, gatewayOver, okStep } from '../../test-support/gateway-test-helpers.js';
import { createHttpShopifyGateway } from './http-shopify-gateway.js';

const TOKEN = 'shpat_CANARY_GATEWAY_TOKEN';
describe('getShopInfo', () => {
  it('maps the plan public display name and the other fields', async () => {
    const { gateway } = gatewayOver([
      okStep(healthyShopBody, { 'x-shopify-api-version': '2026-10' }),
    ]);
    const read = await gateway.getShopInfo(connectionFor('mystore.myshopify.com', TOKEN));
    expect(read).toEqual({
      value: {
        id: 'gid://shopify/Shop/1',
        name: 'My Store',
        myshopifyDomain: 'mystore.myshopify.com',
        currencyCode: 'USD',
        planName: 'Basic',
        shopifyPlus: false,
        partnerDevelopment: false,
      },
      apiVersionUsed: '2026-10',
    });
  });

  it.each([
    ['absent currencyCode', shopMissingCurrencyBody],
    ['numeric id', shopNumericIdBody],
  ])('fails with INVALID_RESPONSE on %s', async (_name, body) => {
    const { gateway } = gatewayOver([okStep(body)]);
    await expect(
      gateway.getShopInfo(connectionFor('mystore.myshopify.com', TOKEN)),
    ).rejects.toMatchObject({ kind: 'INVALID_RESPONSE' });
  });
});

describe('getGrantedScopes', () => {
  it('returns unique handles in the order received', async () => {
    const { gateway } = gatewayOver([okStep(grantedScopesBody)]);
    const read = await gateway.getGrantedScopes(connectionFor('mystore.myshopify.com', TOKEN));
    expect(read.value).toEqual(['write_products', 'read_locations']);
    expect(read.apiVersionUsed).toBeNull();
  });
});

describe('request shape', () => {
  it('is one POST with three headers and a JSON body, the token only in the header', async () => {
    const { gateway, calls } = gatewayOver([okStep(healthyShopBody)]);
    await gateway.getShopInfo(connectionFor('mystore.myshopify.com', TOKEN));
    const [call] = calls;
    expect(calls).toHaveLength(1);
    expect(call?.method).toBe('POST');
    expect(call?.url).toBe('https://mystore.myshopify.com/admin/api/2026-10/graphql.json');
    expect(call?.headers).toMatchObject({
      'content-type': 'application/json',
      accept: 'application/json',
      'x-shopify-access-token': TOKEN,
    });
    expect(Object.keys(JSON.parse(String(call?.body)) as object).sort()).toEqual([
      'query',
      'variables',
    ]);
    expect(String(call?.body)).not.toContain(TOKEN);
    expect(call?.url).not.toContain(TOKEN);
  });

  it('uses the configured version', async () => {
    const { gateway, calls } = gatewayOver([okStep(healthyShopBody)]);
    await gateway.getShopInfo(connectionFor('mystore.myshopify.com', TOKEN, '2027-01'));
    expect(calls[0]?.url).toContain('/admin/api/2027-01/');
  });

  it('declares retry safe and an estimated cost on every read', async () => {
    const execute = vi
      .fn<(input: { retry?: string; estimatedCost?: number }) => never>()
      .mockRejectedValue(new Error('stop'));
    const gateway = createHttpShopifyGateway({ execute });
    const connection = connectionFor('mystore.myshopify.com', TOKEN);
    await Promise.allSettled([
      gateway.getShopInfo(connection),
      gateway.getGrantedScopes(connection),
      gateway.listLocations(connection),
    ]);
    expect(execute.mock.calls.map(([input]) => [input.retry, input.estimatedCost])).toEqual([
      ['safe', 2],
      ['safe', 2],
      ['safe', 52],
    ]);
  });
});

describe('many stores at once', () => {
  it('sends each request to its own domain with its own token', async () => {
    const { gateway, calls } = gatewayOver([okStep(healthyShopBody), okStep(healthyShopBody)]);
    await Promise.all([
      gateway.getShopInfo(connectionFor('alpha.myshopify.com', 'token-alpha')),
      gateway.getShopInfo(connectionFor('beta.myshopify.com', 'token-beta')),
    ]);
    const pairs = calls.map((c) => [new URL(c.url).host, c.headers['x-shopify-access-token']]);
    expect(pairs).toContainEqual(['alpha.myshopify.com', 'token-alpha']);
    expect(pairs).toContainEqual(['beta.myshopify.com', 'token-beta']);
    expect(pairs).toHaveLength(2);
  });
});
