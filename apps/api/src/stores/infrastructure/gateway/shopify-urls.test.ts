import { describe, expect, it, vi } from 'vitest';
import { parseShopDomain, type ShopDomain } from '../../domain/shop-domain.js';
import { isShopifyRequest } from './shopify-request.js';
import { shopifyUrls } from './shopify-urls.js';

const domain = (input: string): ShopDomain => {
  const parsed = parseShopDomain(input);
  if (!parsed.ok) throw new Error('fixture domain must be valid');
  return parsed.domain;
};
const shop = domain('mystore.myshopify.com');

describe('shopifyUrls', () => {
  it('builds the GraphQL URL from the domain and version', () => {
    const request = shopifyUrls.graphql(shop, '2026-10');
    expect(request.url).toBe('https://mystore.myshopify.com/admin/api/2026-10/graphql.json');
    expect(isShopifyRequest(request)).toBe(true);
  });

  it('builds the token URL from the domain only', () => {
    expect(shopifyUrls.token(shop).url).toBe(
      'https://mystore.myshopify.com/admin/oauth/access_token',
    );
  });

  it('never carries a port, userinfo or query', () => {
    for (const { url } of [shopifyUrls.graphql(shop, '2026-10'), shopifyUrls.token(shop)]) {
      const parsed = new URL(url);
      expect([parsed.port, parsed.username, parsed.password, parsed.search, parsed.hash]).toEqual([
        '',
        '',
        '',
        '',
        '',
      ]);
      expect(parsed.protocol).toBe('https:');
    }
  });

  it.each(['latest', '2026-05', '2026-10/../x', '2026-10?a=1', ''])(
    'refuses the version %j',
    (version) => {
      expect(() => shopifyUrls.graphql(shop, version)).toThrow(TypeError);
    },
  );

  it('refuses a raw string at compile time and a forged object at run time', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    // @ts-expect-error a raw string is not a ShopDomain
    expect(() => shopifyUrls.token('evil.example.com')).toThrow(TypeError);
    expect(isShopifyRequest({ url: 'https://evil.example.com/' })).toBe(false);
    expect(isShopifyRequest('https://mystore.myshopify.com/')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
