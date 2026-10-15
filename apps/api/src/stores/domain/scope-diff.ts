import {
  LOCATIONS_ALTERNATIVES,
  REQUIRED_CAPABILITIES,
  type Capability,
} from '@importer/contracts';

export interface ScopeDiff {
  readonly granted: readonly string[];
  readonly missing: readonly Capability[];
}

/** A `write_x` scope also counts as `read_x`; a read never meets a write. */
const effectiveScopes = (granted: readonly string[]): Set<string> => {
  const scopes = new Set(granted);
  for (const scope of granted) {
    if (scope.startsWith('write_')) scopes.add(`read_${scope.slice('write_'.length)}`);
  }
  return scopes;
};

/** Required capabilities not met by the granted scopes, in the order of the required list. */
export const diffScopes = (granted: readonly string[]): ScopeDiff => {
  const scopes = effectiveScopes(granted);
  const met = (capability: Capability): boolean =>
    capability === 'locations'
      ? LOCATIONS_ALTERNATIVES.some((alternative) => scopes.has(alternative))
      : scopes.has(capability);
  return { granted, missing: REQUIRED_CAPABILITIES.filter((capability) => !met(capability)) };
};
