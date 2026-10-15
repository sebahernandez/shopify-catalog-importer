import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Task 19.11: the README (read only) must keep the disclosures the specs require. The README is
// Spanish, so the assertions look for the load-bearing Spanish phrases.
const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');

/** The text of the `## heading` section, up to the next `## `. */
function section(heading: string): string {
  const start = readme.indexOf(`## ${heading}`);
  expect(start, `section ${heading}`).toBeGreaterThanOrEqual(0);
  const rest = readme.slice(start + heading.length + 3);
  const end = rest.search(/^## /m);
  return (end === -1 ? rest : rest.slice(0, end)).replace(/\s+/g, ' ');
}

describe('the limitations section', () => {
  const limitations = section('Limitaciones conocidas');

  it('states that the local API has no authentication and what that allows', () => {
    expect(limitations).toMatch(/no tiene autenticación/);
    expect(limitations).toMatch(/crear, reemplazar o borrar las credenciales/);
    expect(limitations).toMatch(/cualquier proceso/i);
    expect(limitations).toMatch(/solo se aplican las guardas de `Host` y `Origin`/);
  });

  it('notes that the set of redacted secret values grows during the process life', () => {
    expect(limitations).toMatch(/crece durante la vida del proceso/);
  });
});

describe('the section "Qué se verificó y qué no"', () => {
  const verified = section('Qué se verificó y qué no');

  it('states that nothing was verified against a real Shopify store', () => {
    expect(verified).toMatch(/Nada se verificó contra una tienda real de Shopify/);
  });

  it.each([
    ['throttling', /throttling/],
    ['access denied', /ACCESS_DENIED/],
    ['a bad token', /token inválido/],
    ['version fall-forward', /fall-forward/],
    ['client-credentials errors', /client credentials/],
    ['granted scope strings', /granted scopes/],
    ['plan values', /plan de la tienda/],
    ['locations limits', /límites de `locations`/],
    ['rename redirects', /redirecciones por cambio de nombre/],
  ])('lists %s as unverified', (_name, pattern) => {
    expect(verified).toMatch(pattern);
  });

  it('plans the live smoke test for a later slice', () => {
    expect(verified).toMatch(/prueba de humo en vivo/);
    expect(verified).toMatch(/etapa posterior/);
  });

  it('says every example is hand-authored from documentation', () => {
    expect(verified).toMatch(/hand-authored-from-documentation/);
  });
});

describe('the key backup note', () => {
  it('says the key now protects real credentials', () => {
    const note = section('Clave de cifrado');
    expect(note).toMatch(/credenciales reales de sus tiendas de Shopify/);
  });
});

describe('the fixtures', () => {
  it('include none tagged as recorded', () => {
    const dir = fileURLToPath(new URL('./fixtures/', import.meta.url));
    const files = readdirSync(dir).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    );
    expect(files.length).toBeGreaterThan(3);
    for (const name of files) {
      expect(readFileSync(join(dir, name), 'utf8'), name).not.toMatch(/tag:\s*['"]recorded/);
    }
  });
});
