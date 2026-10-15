/** Where a fixture came from. S2 has no real store, so nothing may be tagged `recorded`. */
export interface FixtureProvenance {
  readonly tag: 'hand-authored-from-documentation';
  /** A source claim or URL the shape is based on. */
  readonly source: string;
  /** What the fixture assumes that the documentation does not state. */
  readonly assumption: string;
}

/** Returns a problem description, or null when `value` is an acceptable S2 provenance. */
export const provenanceProblem = (value: unknown): string | null => {
  if (typeof value !== 'object' || value === null) return 'provenance is missing';
  const { tag, source, assumption } = value as Record<string, unknown>;
  if (tag === 'recorded') return 'no S2 fixture may be tagged recorded';
  if (tag !== 'hand-authored-from-documentation') return 'provenance tag is missing or unknown';
  if (typeof source !== 'string' || source.trim() === '') return 'provenance source is missing';
  if (typeof assumption !== 'string' || assumption.trim() === '') {
    return 'provenance assumption note is missing';
  }
  return null;
};

export const DOC_TAG = 'hand-authored-from-documentation' as const;
