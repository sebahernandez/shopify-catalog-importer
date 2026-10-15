import type { Location } from '../ports/shopify-gateway.port.js';

export type LocationResolution =
  | { readonly ok: true; readonly id: string }
  | {
      readonly ok: false;
      readonly code: 'LOCATION_NOT_FOUND' | 'LOCATION_AMBIGUOUS' | 'LOCATION_REQUIRED';
    };

const canonical = (text: string): string => text.trim().normalize('NFC');
const folded = (text: string): string => canonical(text).toLowerCase();

/**
 * Resolves the workbook `ubicacion` text against the active locations of the store.
 *
 * A name matches exactly (after trimming and Unicode normalization) first; only when nothing
 * matches exactly does a case-insensitive match count. More than one match is ambiguous. An empty
 * name means the single active location, and only when the store has exactly one and the list is
 * complete.
 */
export const createLocationResolver = (
  locations: readonly Location[],
  truncated: boolean,
): ((name: string | undefined) => LocationResolution) => {
  const active = locations.filter((location) => location.isActive);
  return (name) => {
    if (name === undefined || canonical(name) === '') {
      const [only] = active;
      return active.length === 1 && !truncated && only !== undefined
        ? { ok: true, id: only.id }
        : { ok: false, code: 'LOCATION_REQUIRED' };
    }
    const exact = active.filter((location) => canonical(location.name) === canonical(name));
    const matches =
      exact.length > 0 ? exact : active.filter((l) => folded(l.name) === folded(name));
    const [match] = matches;
    if (matches.length === 1 && match !== undefined) return { ok: true, id: match.id };
    return { ok: false, code: matches.length === 0 ? 'LOCATION_NOT_FOUND' : 'LOCATION_AMBIGUOUS' };
  };
};
