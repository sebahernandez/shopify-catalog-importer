import type { ShopDomain } from '../../domain/shop-domain.js';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import type {
  CreateProductInput,
  CreateProductResult,
  GatewayRead,
  Location,
  ShopInfo,
  ShopifyGateway,
  StoreConnection,
} from '../../ports/shopify-gateway.port.js';
import { SimulatorFaults } from './simulator-faults.js';
import type { SimulatorOperation } from './simulator-faults.js';

const MAX_LOCATIONS = 250;

export type { SimulatorOperation };

export interface SimulatedShop {
  /** Defaults to `gid://shopify/Shop/<domain>`. */
  readonly id?: string;
  readonly name: string;
  readonly currencyCode: string;
  readonly planName: string;
  readonly shopifyPlus: boolean;
  readonly partnerDevelopment: boolean;
  readonly scopes: readonly string[];
  readonly locations: readonly Location[];
}

const byNameThenId = (a: Location, b: Location): number =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** What the simulator stored for one created product. */
export interface SimulatedProduct {
  readonly id: string;
  readonly input: CreateProductInput;
}

/** In-memory gateway: no network, timers or randomness; output order is deterministic. */
export class SimulatedShopifyGateway implements ShopifyGateway {
  /** Operation names in call order, for tests. */
  readonly calls: SimulatorOperation[] = [];
  /** Script faults here; see SimulatorFaults. */
  readonly faults = new SimulatorFaults();
  private readonly shops = new Map<ShopDomain, SimulatedShop>();
  private readonly products = new Map<ShopDomain, SimulatedProduct[]>();
  private nextProduct = 1;
  private nextVariant = 1;
  private nextMedia = 1;

  addShop(domain: ShopDomain, shop: SimulatedShop): void {
    this.shops.set(domain, shop);
  }

  getShopInfo(connection: StoreConnection): Promise<GatewayRead<ShopInfo>> {
    return this.run('getShopInfo', connection, (domain, shop) => ({
      id: shop.id ?? `gid://shopify/Shop/${domain}`,
      name: shop.name,
      myshopifyDomain: domain,
      currencyCode: shop.currencyCode,
      planName: shop.planName,
      shopifyPlus: shop.shopifyPlus,
      partnerDevelopment: shop.partnerDevelopment,
    }));
  }

  getGrantedScopes(connection: StoreConnection): Promise<GatewayRead<string[]>> {
    return this.run('getGrantedScopes', connection, (_domain, shop) => [...new Set(shop.scopes)]);
  }

  listLocations(
    connection: StoreConnection,
  ): Promise<GatewayRead<{ locations: Location[]; truncated: boolean }>> {
    return this.run('listLocations', connection, (_domain, shop) => {
      const active = shop.locations.filter((l) => l.isActive).sort(byNameThenId);
      return {
        locations: active.slice(0, MAX_LOCATIONS),
        truncated: active.length > MAX_LOCATIONS,
      };
    });
  }

  /**
   * Creates a draft product. Like Shopify it answers `rejected` (never a throw) for a handle that
   * is already taken in the shop, for a location that is not one of the shop's active locations
   * and for a variant that repeats another's option values. The simulator never retries and
   * keeps no partial state: a rejected product is not stored.
   */
  createProduct(
    connection: StoreConnection,
    input: CreateProductInput,
  ): Promise<GatewayRead<CreateProductResult>> {
    return this.run('createProduct', connection, (domain, shop): CreateProductResult => {
      const stored = this.products.get(domain) ?? [];
      const rejected = (field: string[], code: string): CreateProductResult => ({
        kind: 'rejected',
        userErrors: [{ field, code }],
      });
      if (stored.some((product) => product.input.handle === input.handle)) {
        return rejected(['input', 'handle'], 'TAKEN');
      }
      const known = new Set(shop.locations.filter((l) => l.isActive).map((l) => l.id));
      const unknownLocation = input.variants.findIndex(
        ({ inventory }) => inventory !== undefined && !known.has(inventory.locationId),
      );
      if (unknownLocation >= 0) {
        return rejected(
          ['input', 'variants', String(unknownLocation), 'inventoryQuantities'],
          'INVALID_INVENTORY_LOCATION',
        );
      }
      const combos = input.variants.map(({ optionValues }) =>
        optionValues.map(({ name }) => name).join('\u0000'),
      );
      if (new Set(combos).size !== combos.length) {
        return rejected(['input', 'variants'], 'VARIANT_ALREADY_EXISTS');
      }
      const id = `gid://shopify/Product/${this.nextProduct++}`;
      this.products.set(domain, [...stored, { id, input }]);
      return {
        kind: 'created',
        product: {
          id,
          handle: input.handle,
          variants: input.variants.map(({ sku }) => ({
            id: `gid://shopify/ProductVariant/${this.nextVariant++}`,
            sku,
          })),
          media: input.images.map(() => ({
            id: `gid://shopify/MediaImage/${this.nextMedia++}`,
            status: 'UPLOADED' as const,
          })),
        },
        userErrors: [],
      };
    });
  }

  /** The products created in `domain`, in creation order, for tests. */
  createdProducts(domain: ShopDomain): readonly SimulatedProduct[] {
    return this.products.get(domain) ?? [];
  }

  // Async so any throw becomes a rejection; calls are logged and counted in call order.
  private async run<T>(
    operation: SimulatorOperation,
    connection: StoreConnection,
    read: (domain: ShopDomain, shop: SimulatedShop) => T,
  ): Promise<GatewayRead<T>> {
    await Promise.resolve();
    this.calls.push(operation);
    const { apiVersionUsed } = this.faults.apply(operation, connection.apiVersion);
    const shop = this.shops.get(connection.shopDomain);
    if (shop === undefined) throw new ShopifyGatewayError('STORE_NOT_FOUND');
    return { value: read(connection.shopDomain, shop), apiVersionUsed };
  }
}
