/** The Admin GraphQL operations: the three S2 reads and the product write. No API version appears here: the client takes it from configuration. */
export interface GraphqlOperation {
  readonly query: string;
  /** Declared estimated cost in points, hand-computed [A]; far below the 1,000 point cap. */
  readonly estimatedCost: number;
}

export const SHOP_INFO_OPERATION: GraphqlOperation = {
  query:
    'query ShopInfo { shop { id name myshopifyDomain currencyCode plan { publicDisplayName partnerDevelopment shopifyPlus } } }',
  estimatedCost: 2,
};

export const GRANTED_SCOPES_OPERATION: GraphqlOperation = {
  query: 'query GrantedScopes { currentAppInstallation { accessScopes { handle } } }',
  estimatedCost: 2,
};

export const LOCATIONS_PAGE_SIZE = 50;

export const LOCATIONS_OPERATION: GraphqlOperation = {
  query: `query Locations($after: String) { locations(first: ${LOCATIONS_PAGE_SIZE}, after: $after, includeInactive: false, includeLegacy: false) { nodes { id name isActive fulfillsOnlineOrders } pageInfo { hasNextPage endCursor } } }`,
  estimatedCost: 52,
};

export const PRODUCT_VARIANTS_PAGE = 100;
export const PRODUCT_MEDIA_PAGE = 20;

/**
 * One product, one call: `productSet` in synchronous mode returns the product. The cost is
 * hand-computed [A]: 10 for the mutation, 1 for the product, 102 for 100 variants (2 + 100), 22
 * for 20 media (2 + 20) and 1 for the user errors, rounded up to 140; far below the 1,000 cap.
 */
export const PRODUCT_SET_OPERATION: GraphqlOperation = {
  query: `mutation ProductSet($input: ProductSetInput!) { productSet(synchronous: true, input: $input) { product { id handle variants(first: ${PRODUCT_VARIANTS_PAGE}) { nodes { id sku } } media(first: ${PRODUCT_MEDIA_PAGE}) { nodes { id status } } } userErrors { field message code } } }`,
  estimatedCost: 140,
};
