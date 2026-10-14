/** Key for sheet names and headers: accents, case and surrounding whitespace never matter. */
export function matchKey(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').trim().toLowerCase();
}
