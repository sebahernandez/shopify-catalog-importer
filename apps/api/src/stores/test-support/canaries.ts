/**
 * Distinct secret-looking values for the leak suites (task 19.2). Each stands for one kind of
 * secret the module handles; none of them may ever appear in a log, a response, an error or a
 * file. They are synthetic: none is a real credential.
 */
export const CANARIES = {
  staticToken: 'canary-static-token-8a1f3c9e5d7b',
  clientSecret: 'canary-client-secret-4b6d2e8a0c1f',
  exchangedToken: 'canary-exchanged-token-7c3e9a1b5d2f',
  // Built by concatenation so no source line matches a secret scanner's token pattern.
  shopifyShaped: 'shpat_' + '0123456789abcdef0123456789abcdef',
  bearer: 'Bearer canary-bearer-credential-2d4f6a8c0e1b',
} as const;

export type CanaryName = keyof typeof CANARIES;

/** Everything a scanner looks for: each canary and the bare credential of the Bearer one. */
const NEEDLES: readonly string[] = [
  ...Object.values(CANARIES),
  CANARIES.bearer.slice('Bearer '.length),
];

export const ALL_CANARIES: readonly string[] = Object.values(CANARIES);

/** The needles found in `text`. */
export function canariesIn(text: string): string[] {
  return NEEDLES.filter((needle) => text.includes(needle));
}

/** The needles found in raw file bytes (searched as latin1, so any byte layout matches). */
export function canariesInBytes(bytes: Uint8Array): string[] {
  return canariesIn(Buffer.from(bytes).toString('latin1'));
}

const MAX_DEPTH = 20;

/**
 * The needles found anywhere in an error: its name, message, stack, every own property (also the
 * non-enumerable ones) and the full `cause` chain, including errors nested in properties.
 */
export function canariesInError(error: unknown): string[] {
  const found = new Set<string>();
  const seen = new Set<unknown>();
  const visit = (value: unknown, depth: number): void => {
    if (depth > MAX_DEPTH) return;
    if (typeof value === 'string') {
      for (const hit of canariesIn(value)) found.add(hit);
      return;
    }
    if (typeof value !== 'object' || value === null || seen.has(value)) return;
    seen.add(value);
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor !== undefined && 'value' in descriptor) visit(descriptor.value, depth + 1);
    }
  };
  visit(error, 0);
  if (error instanceof Error) {
    // Reached through the loop above, but named explicitly: these are the usual leak points.
    for (const text of [error.name, error.message, error.stack ?? '']) {
      for (const hit of canariesIn(text)) found.add(hit);
    }
  }
  return [...found];
}
