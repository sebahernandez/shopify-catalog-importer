/** Capabilities the importer needs. `locations` is met by any one of `LOCATIONS_ALTERNATIVES`. */
export const REQUIRED_CAPABILITIES = Object.freeze([
  'write_products',
  'write_files',
  'write_inventory',
  'locations',
] as const);

export type Capability = (typeof REQUIRED_CAPABILITIES)[number];

/** Scope handles that each satisfy the `locations` capability. */
export const LOCATIONS_ALTERNATIVES = Object.freeze([
  'read_locations',
  'read_inventory',
  'read_markets_home',
] as const);
