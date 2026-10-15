import { DOC_TAG, type FixtureProvenance } from './fixture-meta.js';

export const provenance: FixtureProvenance = {
  tag: DOC_TAG,
  source: 'https://shopify.dev/docs/api/admin-graphql/2026-10/objects/AccessScope',
  assumption: 'Exact scope handle strings and the repetition of a handle are assumed.',
};

const scopes = (handles: string[]) => ({
  data: { currentAppInstallation: { accessScopes: handles.map((handle) => ({ handle })) } },
});

/** Contains `write_products` twice. */
export const grantedScopesBody = scopes(['write_products', 'read_locations', 'write_products']);
export const fullScopesBody = scopes([
  'write_products',
  'write_files',
  'write_inventory',
  'read_locations',
]);
