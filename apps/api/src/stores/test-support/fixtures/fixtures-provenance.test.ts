import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { provenanceProblem } from './fixture-meta.js';

const dir = dirname(fileURLToPath(import.meta.url));
const fixtureFiles = readdirSync(dir).filter(
  (f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'fixture-meta.ts',
);

describe('fixture provenance', () => {
  it('walks the whole fixtures folder and finds the S2 fixtures', () => {
    expect(fixtureFiles).toEqual([
      'error-bodies.ts',
      'granted-scopes.ts',
      'locations.ts',
      'shop-info.ts',
    ]);
  });

  it.each(fixtureFiles)(
    '%s exports a hand-authored provenance with source and assumption',
    async (file) => {
      const module = (await import(join(dir, file))) as { provenance?: unknown };
      expect(provenanceProblem(module.provenance)).toBeNull();
      expect(module.provenance).toMatchObject({ tag: 'hand-authored-from-documentation' });
    },
  );

  it('rejects a missing tag, a recorded tag, and missing notes (synthetic bad fixtures)', () => {
    expect(provenanceProblem(undefined)).not.toBeNull();
    expect(provenanceProblem({ source: 's', assumption: 'a' })).not.toBeNull();
    expect(provenanceProblem({ tag: 'recorded', source: 's', assumption: 'a' })).toMatch(
      /recorded/,
    );
    expect(
      provenanceProblem({ tag: 'hand-authored-from-documentation', source: '', assumption: 'a' }),
    ).not.toBeNull();
    expect(
      provenanceProblem({ tag: 'hand-authored-from-documentation', source: 's', assumption: ' ' }),
    ).not.toBeNull();
  });
});
