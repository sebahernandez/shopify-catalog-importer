import type { ShopDomain } from '../domain/shop-domain.js';
import type { CredentialProvider } from './credential-provider.port.js';

export interface ShopInfo {
  readonly id: string;
  readonly name: string;
  readonly myshopifyDomain: string;
  readonly currencyCode: string;
  readonly planName: string;
  readonly shopifyPlus: boolean;
  readonly partnerDevelopment: boolean;
}

export interface Location {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly fulfillsOnlineOrders: boolean;
}

/** Everything a gateway needs to reach one store; the gateway keeps no per-store state. */
export interface StoreConnection {
  readonly storeId: string;
  readonly shopDomain: ShopDomain;
  readonly apiVersion: string;
  readonly credentials: CredentialProvider;
}

/** A read result; `apiVersionUsed` is the `X-Shopify-API-Version` header, or null when absent. */
export interface GatewayRead<T> {
  readonly value: T;
  readonly apiVersionUsed: string | null;
}

/** Read-only Shopify access. Every failure is a `ShopifyGatewayError`. */
export interface ShopifyGateway {
  getShopInfo(connection: StoreConnection): Promise<GatewayRead<ShopInfo>>;
  /** Scope handles, unique, in the order received. */
  getGrantedScopes(connection: StoreConnection): Promise<GatewayRead<string[]>>;
  /** Active locations, at most 250; `truncated` is true when more exist. */
  listLocations(
    connection: StoreConnection,
  ): Promise<GatewayRead<{ locations: Location[]; truncated: boolean }>>;
}
