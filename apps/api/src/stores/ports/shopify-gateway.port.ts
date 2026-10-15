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

/** Shopify media processing states, plus `UNKNOWN` for a value this app does not know. */
export type MediaStatus = 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED' | 'UNKNOWN';

export interface CreateVariantInput {
  /** One entry per product option, in option order. */
  readonly optionValues: readonly { readonly optionName: string; readonly name: string }[];
  /** Decimal string such as `10.00`. */
  readonly price: string;
  readonly compareAtPrice?: string;
  readonly sku: string;
  readonly barcode?: string;
  readonly tracked: boolean;
  /** Set only for a tracked variant with stock: the absolute `available` quantity at a location. */
  readonly inventory?: { readonly locationId: string; readonly quantity: number };
}

/** A new product. `options` is never empty: a product without options uses a default option. */
export interface CreateProductInput {
  readonly title: string;
  readonly handle: string;
  readonly descriptionHtml?: string;
  readonly vendor?: string;
  readonly productType?: string;
  readonly tags: readonly string[];
  readonly options: readonly { readonly name: string; readonly values: readonly string[] }[];
  readonly variants: readonly CreateVariantInput[];
  /** Public image URLs in display order; the first one is the cover. */
  readonly images: readonly { readonly url: string; readonly alt?: string }[];
}

/** A validation problem Shopify reported. The message is never kept: it can echo request data. */
export interface ProductUserError {
  /** Path of the offending input member, for example `['input', 'handle']`. */
  readonly field: readonly string[] | null;
  /** Shopify's error code, or null when it sent none. */
  readonly code: string | null;
}

/** What Shopify returned for a created product. Lists are capped (100 variants, 20 media). */
export interface CreatedProduct {
  readonly id: string;
  /** The handle Shopify stored, which can differ from the one requested. */
  readonly handle: string;
  readonly variants: readonly { readonly id: string; readonly sku: string | null }[];
  /** Media are processed after creation; these are the statuses at the time of the response. */
  readonly media: readonly { readonly id: string; readonly status: MediaStatus }[];
}

/**
 * `created`: the product exists (`userErrors` then holds only non-blocking problems).
 * `rejected`: Shopify answered with validation problems and created nothing.
 */
export type CreateProductResult =
  | {
      readonly kind: 'created';
      readonly product: CreatedProduct;
      readonly userErrors: readonly ProductUserError[];
    }
  | { readonly kind: 'rejected'; readonly userErrors: readonly ProductUserError[] };

/**
 * Shopify access: three retry-safe reads and one write. The write is never retried, because a
 * lost response does not say whether the product was created. Every failure is a
 * `ShopifyGatewayError`.
 */
export interface ShopifyGateway {
  getShopInfo(connection: StoreConnection): Promise<GatewayRead<ShopInfo>>;
  /** Scope handles, unique, in the order received. */
  getGrantedScopes(connection: StoreConnection): Promise<GatewayRead<string[]>>;
  /** Active locations, at most 250; `truncated` is true when more exist. */
  listLocations(
    connection: StoreConnection,
  ): Promise<GatewayRead<{ locations: Location[]; truncated: boolean }>>;
  /**
   * Creates one product with its variants, inventory and images (`productSet`, synchronous). The
   * product is created as a draft. A validation problem is a `rejected` result, not an error;
   * transport and GraphQL failures throw and are never retried.
   */
  createProduct(
    connection: StoreConnection,
    input: CreateProductInput,
  ): Promise<GatewayRead<CreateProductResult>>;
}
