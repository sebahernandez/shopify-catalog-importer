import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import type { GatewayRead, Location } from '../../ports/shopify-gateway.port.js';

export const MAX_LOCATIONS = 250;
/** Defence against a server that keeps sending pages without active locations. */
const MAX_PAGES = 50;

export interface LocationsPage {
  readonly nodes: readonly Location[];
  readonly hasNextPage: boolean;
  readonly endCursor: string | null;
}

const byNameThenId = (a: Location, b: Location): number =>
  a.name < b.name ? -1 : a.name > b.name ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/** Follows cursors until 251 active locations are seen or no page remains (design D16). */
export const collectLocations = async (
  fetchPage: (after: string | null) => Promise<GatewayRead<LocationsPage>>,
): Promise<GatewayRead<{ locations: Location[]; truncated: boolean }>> => {
  const active: Location[] = [];
  let after: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const read = await fetchPage(after);
    active.push(...read.value.nodes.filter((l) => l.isActive));
    if (active.length > MAX_LOCATIONS || !read.value.hasNextPage) {
      const sorted = [...active].sort(byNameThenId);
      return {
        value: {
          locations: sorted.slice(0, MAX_LOCATIONS),
          truncated: sorted.length > MAX_LOCATIONS,
        },
        apiVersionUsed: read.apiVersionUsed,
      };
    }
    if (read.value.endCursor === null) throw new ShopifyGatewayError('INVALID_RESPONSE');
    after = read.value.endCursor;
  }
  throw new ShopifyGatewayError('INVALID_RESPONSE');
};
