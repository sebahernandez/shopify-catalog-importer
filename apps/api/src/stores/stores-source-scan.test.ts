import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseShopDomain } from './domain/shop-domain.js';

// Task 19.9: structural rules over the non-test sources of the stores module. Each rule is a
// small function proved on a synthetic offender first, so a passing scan cannot be a blind one.
const STORES = fileURLToPath(new URL('.', import.meta.url));
const API_SRC = join(STORES, '..');

function sources(): { path: string; code: string; raw: string }[] {
  return readdirSync(STORES, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter(
      (path) => !path.endsWith('.test.ts') && !path.includes(`${join('stores', 'test-support')}`),
    )
    .map((path) => {
      const raw = readFileSync(path, 'utf8');
      return { path: relative(STORES, path), code: stripComments(raw), raw };
    });
}

export function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<![:'"`\w])\/\/[^\n]*/g, '');
}

type Rule = { name: string; test: (code: string, raw: string) => boolean; allowed?: string[] };

const RULES: Rule[] = [
  {
    name: 'the global fetch is referenced',
    test: (code) => /(?<![\w.])fetch\s*\(|\bglobalThis\.fetch\b|\bwindow\.fetch\b/.test(code),
    // The transport calls the injected function; only the module's default names the global.
    allowed: ['stores.module.ts'],
  },
  {
    name: 'an API version literal appears',
    test: (_code, raw) => /\b(?:19|20)\d{2}-(?:01|04|07|10)\b/.test(raw),
  },
  {
    name: 'the environment is read',
    test: (code) => /process\.env|import\.meta\.env|\bprocess\.argv\b/.test(code),
  },
  {
    name: 'a clock, timer or random source is used directly',
    test: (code) => /\bDate\.now\b|\bsetTimeout\b|\bsetInterval\b|\bMath\.random\b/.test(code),
    allowed: [join('infrastructure', 'gateway', 'gateway-runtime.ts')],
  },
  { name: 'console is called', test: (code) => /\bconsole\s*\./.test(code) },
  { name: 'a cause is assigned or passed', test: (code) => /\bcause\b/.test(code) },
  {
    name: 'Spanish text appears',
    test: (_code, raw) =>
      /[áéíóúñ¿¡ü]/i.test(raw) ||
      /\b(?:para|tienda|tiendas|credenciales|contraseña|configuración|del|los|las|una|que)\b/i.test(
        raw.replace(/https?:\/\/\S+/g, ''),
      ),
  },
];

describe('each rule catches an offender (proved before it is trusted)', () => {
  const OFFENDERS: Record<string, string> = {
    'the global fetch is referenced': 'const x = fetch(url);',
    'an API version literal appears': "const v = '2026-10';",
    'the environment is read': 'const v = process.env.X;',
    'a clock, timer or random source is used directly': 'const t = Date.now();',
    'console is called': 'console.log(1);',
    'a cause is assigned or passed': 'new Error("x", { cause: y });',
    'Spanish text appears': "const m = 'La tienda no es válida';",
  };

  it.each(RULES)('$name', (rule) => {
    const offender = OFFENDERS[rule.name] ?? '';
    expect(rule.test(stripComments(offender), offender)).toBe(true);
  });

  it('ignores a rule word that sits in a comment', () => {
    const text = '// console.log(1) and fetch(x) are not code here\nconst a = 1;';
    expect(
      RULES.some(
        (rule) => rule.name !== 'Spanish text appears' && rule.test(stripComments(text), ''),
      ),
    ).toBe(false);
  });

  it('keeps a URL string while stripping a trailing comment', () => {
    expect(stripComments("const u = 'https://a.example'; // note")).toBe(
      "const u = 'https://a.example'; ",
    );
  });
});

describe('the stores sources', () => {
  const files = sources();

  it('looks at real production sources', () => {
    expect(files.length).toBeGreaterThan(40);
    expect(files.some((file) => file.path === 'stores.module.ts')).toBe(true);
    expect(files.some((file) => file.path.includes('test-support'))).toBe(false);
  });

  it.each(RULES)('never: $name', (rule) => {
    const offenders = files
      .filter((file) => !(rule.allowed ?? []).includes(file.path))
      .filter((file) => rule.test(file.code, file.raw))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it('references the global fetch exactly in the module default', () => {
    const referencing = files.filter((file) => RULES[0]?.test(file.code, file.raw));
    expect(referencing.map((file) => file.path)).toEqual(['stores.module.ts']);
  });

  it('has a fixed suffix: the domain parser takes the input only', () => {
    expect(parseShopDomain.length).toBe(1);
    const domain = files.find((file) => file.path === join('domain', 'shop-domain.ts'));
    expect(domain?.code).toMatch(/myshopify\.com/);
    expect(domain?.code).not.toMatch(/AppConfig|process\.env|SUFFIX_FROM/);
  });
});

describe('the API version configuration tests stay as they were', () => {
  const schemaTest = readFileSync(join(API_SRC, 'config', 'env.schema.test.ts'), 'utf8');

  it('still cover the default, malformed and out-of-set versions (read only)', () => {
    expect(schemaTest).toMatch(/DEFAULT_SHOPIFY_API_VERSION/);
    expect(schemaTest).toMatch(/SHOPIFY_API_VERSION/);
    expect(schemaTest.match(/SHOPIFY_API_VERSION/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});
