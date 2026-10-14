import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const uiRoot = fileURLToPath(new URL('.', import.meta.url));

function sourcesUnder(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((name) => /\.tsx?$/.test(name))
    .map((name) => join(root, name));
}

// Every module specifier of an import, export-from, dynamic import or require in the text.
function specifiersIn(text: string): string[] {
  const pattern = /(?:from\s*|import\s*\(\s*|import\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;
  return [...text.matchAll(pattern)].map((match) => match[1] ?? '');
}

// Presentational code gets props in and gives markup out: it may not reach the data layer or the
// containers. The segment match also catches deeper relative paths and the absolute spelling.
const FORBIDDEN = /(^|\/)(api|app)(\/|$)/;

describe('presentational layer (src/ui)', () => {
  const files = sourcesUnder(uiRoot).filter((file) => !/\.test\.tsx?$/.test(file));

  it('contains the atom and the molecule, so the scan below is not vacuous', () => {
    const names = files.map((file) => file.slice(uiRoot.length));
    expect(names).toContain(join('atoms', 'StatusDot.tsx'));
    expect(names).toContain(join('molecules', 'HealthBadge.tsx'));
  });

  it('never imports from src/api or src/app', () => {
    for (const file of files) {
      const offending = specifiersIn(readFileSync(file, 'utf8')).filter((spec) =>
        FORBIDDEN.test(spec),
      );
      expect(offending, file).toEqual([]);
    }
  });

  it('recognises the imports it is meant to forbid', () => {
    expect(specifiersIn(`import { x } from '../../api/http-client';`)).toEqual([
      '../../api/http-client',
    ]);
    for (const bad of ['../../api/http-client', '../../app/useHealth', '../app/App', 'src/api']) {
      expect(FORBIDDEN.test(bad), bad).toBe(true);
    }
    for (const fine of ['react', '../../i18n/es', '../../health-state', '../atoms/StatusDot']) {
      expect(FORBIDDEN.test(fine), fine).toBe(false);
    }
  });
});
