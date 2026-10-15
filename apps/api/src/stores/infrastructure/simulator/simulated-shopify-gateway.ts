import type { ShopDomain } from '../../domain/shop-domain.js';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import type {
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

/** In-memory gateway: no network, timers or randomness; output order is deterministic. */
export class SimulatedShopifyGateway implements ShopifyGateway {
  /** Operation names in call order, for tests. */
  readonly calls: SimulatorOperation[] = [];
  /** Script faults here; see SimulatorFaults. */
  readonly faults = new SimulatorFaults();
  private readonly shops = new Map<ShopDomain, SimulatedShop>();

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
