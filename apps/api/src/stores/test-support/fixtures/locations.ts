import { DOC_TAG, type FixtureProvenance } from './fixture-meta.js';

export const provenance: FixtureProvenance = {
  tag: DOC_TAG,
  source: 'https://shopify.dev/docs/api/admin-graphql/2026-10/queries/locations',
  assumption: 'Page size limits, required scope and cursor format are undocumented.',
};

export interface LocationNode {
  id: string;
  name: string;
  isActive: boolean;
  fulfillsOnlineOrders: boolean;
}

export const location = (n: number, isActive = true): LocationNode => ({
  id: `gid://shopify/Location/${String(n).padStart(4, '0')}`,
  name: `Location ${String(n).padStart(4, '0')}`,
  isActive,
  fulfillsOnlineOrders: true,
});

export const locationsPage = (
  nodes: LocationNode[],
  endCursor: string | null,
  hasNextPage = endCursor !== null,
) => ({ data: { locations: { nodes, pageInfo: { hasNextPage, endCursor } } } });

export const emptyLocationsBody = locationsPage([], null);
export const threeActiveBody = locationsPage([location(1), location(2), location(3)], null);
export const inactiveMixBody = locationsPage([location(1, false), location(2), location(3)], null);

/** `total` active locations split into pages of `size`, linked by cursors `c1`, `c2`, and so on. */
export const pagedLocations = (total: number, size = 50) => {
  const pages = [];
  for (let start = 0; start < total; start += size) {
    const nodes = Array.from({ length: Math.min(size, total - start) }, (_, i) =>
      location(start + i + 1),
    );
    const last = start + size >= total;
    pages.push(locationsPage(nodes, last ? null : `c${pages.length + 1}`, !last));
  }
  return pages;
};

/** 251 active locations over six pages. */
export const locations251Pages = pagedLocations(251);
