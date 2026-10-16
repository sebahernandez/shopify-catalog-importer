/** Builds an element id or a list key from parts. Kept out of JSX so no template literal sits in markup. */
export function joinId(...parts: readonly (string | number | null)[]): string {
  return parts.join('-');
}
