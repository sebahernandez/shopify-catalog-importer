import { DOC_TAG, type FixtureProvenance } from './fixture-meta.js';

export const provenance: FixtureProvenance = {
  tag: DOC_TAG,
  source: 'https://shopify.dev/docs/api/admin-graphql/2026-10/objects/Shop',
  assumption: 'Plan values such as Basic and the exact shop id format are not documented.',
};

const shop = {
  id: 'gid://shopify/Shop/1',
  name: 'My Store',
  myshopifyDomain: 'mystore.myshopify.com',
  currencyCode: 'USD',
  plan: { publicDisplayName: 'Basic', partnerDevelopment: false, shopifyPlus: false },
};

export const healthyShopBody = { data: { shop } };

const withoutCurrency = { ...shop, currencyCode: undefined };
export const shopMissingCurrencyBody = { data: { shop: withoutCurrency } };

export const shopNumericIdBody = { data: { shop: { id: 5 } } };
