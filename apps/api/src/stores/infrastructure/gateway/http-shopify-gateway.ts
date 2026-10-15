import type { createShopifyGraphqlClient } from './shopify-graphql-client.js';
import type {
  CreateProductInput,
  CreateProductResult,
  GatewayRead,
  Location,
  ShopInfo,
  ShopifyGateway,
  StoreConnection,
} from '../../ports/shopify-gateway.port.js';
import {
  GRANTED_SCOPES_OPERATION,
  LOCATIONS_OPERATION,
  PRODUCT_SET_OPERATION,
  SHOP_INFO_OPERATION,
} from './graphql-operations.js';
import { collectLocations } from './locations-paging.js';
import { productSetVariables, toCreateProductResult } from './product-set-mapping.js';
import {
  grantedScopesSchema,
  locationsPageSchema,
  productSetSchema,
  shopInfoSchema,
} from './response-schemas.js';

type GraphqlClient = Pick<ReturnType<typeof createShopifyGraphqlClient>, 'execute'>;

/** The Admin GraphQL implementation of the port: reads are retry-safe, the write is never retried. */
export const createHttpShopifyGateway = (client: GraphqlClient): ShopifyGateway => ({
  async getShopInfo(connection: StoreConnection): Promise<GatewayRead<ShopInfo>> {
    const read = await client.execute({
      connection,
      query: SHOP_INFO_OPERATION.query,
      variables: {},
      schema: shopInfoSchema,
      estimatedCost: SHOP_INFO_OPERATION.estimatedCost,
      retry: 'safe',
    });
    const { shop } = read.value;
    return {
      value: {
        id: shop.id,
        name: shop.name,
        myshopifyDomain: shop.myshopifyDomain,
        currencyCode: shop.currencyCode,
        planName: shop.plan.publicDisplayName,
        shopifyPlus: shop.plan.shopifyPlus,
        partnerDevelopment: shop.plan.partnerDevelopment,
      },
      apiVersionUsed: read.apiVersionUsed,
    };
  },

  async getGrantedScopes(connection: StoreConnection): Promise<GatewayRead<string[]>> {
    const read = await client.execute({
      connection,
      query: GRANTED_SCOPES_OPERATION.query,
      variables: {},
      schema: grantedScopesSchema,
      estimatedCost: GRANTED_SCOPES_OPERATION.estimatedCost,
      retry: 'safe',
    });
    const handles = read.value.currentAppInstallation.accessScopes.map((s) => s.handle);
    return { value: [...new Set(handles)], apiVersionUsed: read.apiVersionUsed };
  },

  listLocations(
    connection: StoreConnection,
  ): Promise<GatewayRead<{ locations: Location[]; truncated: boolean }>> {
    return collectLocations(async (after) => {
      const read = await client.execute({
        connection,
        query: LOCATIONS_OPERATION.query,
        variables: { after },
        schema: locationsPageSchema,
        estimatedCost: LOCATIONS_OPERATION.estimatedCost,
        retry: 'safe',
      });
      const { nodes, pageInfo } = read.value.locations;
      return { value: { nodes, ...pageInfo }, apiVersionUsed: read.apiVersionUsed };
    });
  },

  async createProduct(
    connection: StoreConnection,
    input: CreateProductInput,
  ): Promise<GatewayRead<CreateProductResult>> {
    const read = await client.execute({
      connection,
      query: PRODUCT_SET_OPERATION.query,
      variables: productSetVariables(input),
      schema: productSetSchema,
      estimatedCost: PRODUCT_SET_OPERATION.estimatedCost,
      retry: 'none',
    });
    return { value: toCreateProductResult(read.value), apiVersionUsed: read.apiVersionUsed };
  },
});
