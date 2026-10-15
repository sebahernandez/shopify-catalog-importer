import { describe, expectTypeOf, it } from 'vitest';
import type { ShopDomain } from '../domain/shop-domain.js';
import type { CredentialProvider } from './credential-provider.port.js';
import type {
  GatewayRead,
  Location,
  ShopInfo,
  ShopifyGateway,
  StoreConnection,
} from './shopify-gateway.port.js';

// Checked by `pnpm typecheck`: vitest only runs the (empty) bodies.
describe('ShopifyGateway port (type level)', () => {
  it('exposes the three reads and the product write', () => {
    expectTypeOf<keyof ShopifyGateway>().toEqualTypeOf<
      'getShopInfo' | 'getGrantedScopes' | 'listLocations' | 'createProduct'
    >();
  });

  it('carries a branded shop domain in the connection', () => {
    expectTypeOf<StoreConnection['storeId']>().toEqualTypeOf<string>();
    expectTypeOf<StoreConnection['shopDomain']>().toEqualTypeOf<ShopDomain>();
    expectTypeOf<StoreConnection['apiVersion']>().toEqualTypeOf<string>();
    expectTypeOf<StoreConnection['credentials']>().toEqualTypeOf<CredentialProvider>();
    expectTypeOf<string>().not.toExtend<StoreConnection['shopDomain']>();
  });

  it('returns GatewayRead from every operation', () => {
    expectTypeOf<GatewayRead<number>['apiVersionUsed']>().toEqualTypeOf<string | null>();
    expectTypeOf<ShopifyGateway['getShopInfo']>().returns.toEqualTypeOf<
      Promise<GatewayRead<ShopInfo>>
    >();
    expectTypeOf<ShopifyGateway['getGrantedScopes']>().returns.toEqualTypeOf<
      Promise<GatewayRead<string[]>>
    >();
    expectTypeOf<ShopifyGateway['listLocations']>().returns.toEqualTypeOf<
      Promise<GatewayRead<{ locations: Location[]; truncated: boolean }>>
    >();
  });
});
