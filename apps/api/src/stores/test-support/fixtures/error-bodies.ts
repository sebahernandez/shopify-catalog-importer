import { DOC_TAG, type FixtureProvenance } from './fixture-meta.js';

export const provenance: FixtureProvenance = {
  tag: DOC_TAG,
  source:
    'https://shopify.dev/docs/api/usage/rate-limits and https://shopify.dev/docs/api/admin-graphql',
  assumption:
    'Exact bodies and statuses of THROTTLED, ACCESS_DENIED, invalid key and token endpoint failures are not documented.',
};

const failure = (code: string, message: string) => ({
  errors: [{ message, extensions: { code } }],
});

export const throttled200Body = failure('THROTTLED', 'Throttled');
export const accessDenied200Body = failure('ACCESS_DENIED', 'Access denied for shop field.');
export const invalidKey401Body = {
  errors: 'Invalid API key or access token (unrecognized login or wrong password)',
};
export const invalidKey200Body = {
  errors: [{ message: 'Invalid API key or access token (unrecognized login or wrong password)' }],
};
export const maxCostExceededBody = failure(
  'MAX_COST_EXCEEDED',
  'Query cost is 2003, which exceeds the single query max cost limit (1000)',
);
export const somethingNewBody = failure('SOMETHING_NEW', 'A code nobody knows');
export const htmlMaintenancePage = '<html><body>Maintenance in progress</body></html>';

export const tokenEndpointOkBody = {
  access_token: 'exchanged-token-fixture',
  scope: 'write_products',
  expires_in: 86399,
};
export const tokenEndpointShopNotPermittedBody = { error: 'shop_not_permitted' };
export const tokenEndpointUnknownErrorBody = { error: 'invalid_request' };
