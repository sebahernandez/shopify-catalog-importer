import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

describe('index.html', () => {
  it('declares Spanish, a title, a viewport and a root element', () => {
    expect(html).toMatch(/<html[^>]*\slang="es"/);
    expect(html).toMatch(/<title>[^<]*Shopify Catalog Importer[^<]*<\/title>/);
    expect(html).toMatch(
      /<meta\s+name="viewport"\s+content="width=device-width, initial-scale=1(\.0)?"/,
    );
    expect(html.match(/<div\s+id="root"><\/div>/g)).toHaveLength(1);
  });

  it('loads exactly one module script, from this package', () => {
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatch(/\stype="module"/);
    expect(scripts[0]).toMatch(/\ssrc="\/src\/main\.tsx"/);
    expect(html).toMatch(/<script\b[^>]*><\/script>/);
  });

  it('has nothing inline and nothing from a third-party origin', () => {
    expect(html).not.toMatch(/<style[\s>]/);
    expect(html).not.toMatch(/\sstyle=/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/<(link|iframe|img|base)[\s>]/);
  });
});
