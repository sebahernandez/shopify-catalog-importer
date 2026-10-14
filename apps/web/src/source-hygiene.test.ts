import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcRoot = fileURLToPath(new URL('.', import.meta.url));

// Everything that ships to the browser: all sources under src except tests. (vite.config.ts is
// outside src and is the one file allowed to read the environment.)
const sources = readdirSync(srcRoot, { recursive: true, encoding: 'utf8' })
  .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
  .map((name) => ({ name, text: readFileSync(join(srcRoot, name), 'utf8') }));

const components = sources.filter((file) => file.name.endsWith('.tsx'));
const outsideCatalog = sources.filter((file) => file.name !== join('i18n', 'es.ts'));

function offenders(files: typeof sources, pattern: RegExp): string[] {
  return files.filter((file) => pattern.test(file.text)).map((file) => file.name);
}

describe('web sources', () => {
  it('include the files this scan exists to guard, so it is not vacuous', () => {
    const names = sources.map((file) => file.name);
    for (const expected of [
      join('api', 'http-client.ts'),
      join('app', 'useHealth.ts'),
      join('app', 'HealthStatusContainer.tsx'),
      join('app', 'App.tsx'),
      join('i18n', 'es.ts'),
      join('ui', 'atoms', 'StatusDot.tsx'),
      join('ui', 'molecules', 'HealthBadge.tsx'),
    ]) {
      expect(names).toContain(expected);
    }
  });

  it.each([
    ['dangerouslySetInnerHTML', /dangerouslySetInnerHTML/],
    ['innerHTML or outerHTML', /\b(?:inner|outer)HTML\b/],
    ['insertAdjacentHTML or document.write', /insertAdjacentHTML|document\s*\.\s*write/],
    ['eval', /\beval\s*\(/],
    ['new Function', /new\s+Function\b/],
    ['import.meta.env', /import\s*\.\s*meta\s*\.\s*env/],
    ['process.env', /process\s*\.\s*env/],
    ['localStorage', /localStorage/],
    ['sessionStorage', /sessionStorage/],
    ['document.cookie', /document\s*\.\s*cookie/],
    ['an http or https URL', /https?:\/\//],
    ['a loopback or wildcard host literal', /127\.\d+\.\d+\.\d+|localhost|0\.0\.0\.0/],
    ['a port literal', /:\s*\d{4,5}\b/],
    ['a dynamic href or src', /\b(?:href|src)\s*=/],
  ])('use no %s', (_name, pattern) => {
    expect(offenders(sources, pattern)).toEqual([]);
  });

  it('build every Tailwind class name whole, never from pieces', () => {
    // className must be a literal or a lookup, and no class prefix may be followed by a hole.
    expect(offenders(components, /className=\{[^}]*(?:`|\+|\$\{)/)).toEqual([]);
    expect(offenders(sources, /(?:bg|text|border|ring|rounded|p[xy]?|m[xytblr]?)-\$\{/)).toEqual(
      [],
    );
    expect(components.some((file) => /className=\{[A-Z_]+\[/.test(file.text))).toBe(true);
  });

  it('keep user-visible copy in the catalog: no text, label or Spanish letters in components', () => {
    expect(offenders(components, />\s*[^<>{}\n]*[A-Za-zÀ-ÿ][^<>{}\n]*</)).toEqual([]);
    expect(offenders(components, /\{\s*['"`][^'"`]*[A-Za-zÀ-ÿ][^'"`]*['"`]\s*\}/)).toEqual([]);
    expect(
      offenders(components, /\b(?:aria-label|aria-description|title|alt|placeholder)\s*=\s*["'{]/),
    ).toEqual([]);
    expect(offenders(outsideCatalog, /[áéíóúñüÁÉÍÓÚÑÜ¿¡…]/)).toEqual([]);
  });
});
