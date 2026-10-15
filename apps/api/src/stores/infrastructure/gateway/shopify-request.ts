declare const shopifyRequestBrand: unique symbol;

/** An outbound Shopify request target. Only `shopify-urls.ts` constructs one (design D11). */
export interface ShopifyRequest {
  readonly [shopifyRequestBrand]: true;
  readonly url: string;
}

const issued = new WeakSet<object>();

/** Issues a request target. Reserved for the URL module; the transport never builds one. */
export const issueShopifyRequest = (url: string): ShopifyRequest => {
  const request = Object.freeze({ url }) as ShopifyRequest;
  issued.add(request);
  return request;
};

/** Run-time brand check: a forged object or a string is refused before `fetch` is called. */
export const isShopifyRequest = (value: unknown): value is ShopifyRequest =>
  typeof value === 'object' && value !== null && issued.has(value);
