/** The three S2 reads. No API version appears here: the client takes it from configuration. */
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
