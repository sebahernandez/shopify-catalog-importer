import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App placeholder shell', () => {
  const html = renderToString(createElement(App));

  it('renders one main landmark with the product name as the single heading', () => {
    expect(html.match(/<main[\s>]/g)).toHaveLength(1);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Shopify Catalog Importer<\/h1>/);
    expect(html.match(/<h[2-6][\s>]/g)).toBeNull();
  });

  it('shows a short Spanish line saying the interface is under construction', () => {
    expect(html).toMatch(/<p[^>]*>[^<]*construcci[oó]n[^<]*<\/p>/);
  });

  it('prints no placeholder artefacts and contains no script, link or image', () => {
    expect(html).not.toMatch(/undefined|null|\[object/);
    expect(html).not.toMatch(/<(script|link|img|iframe|a)[\s>]/);
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('renders the same markup every time', () => {
    expect(renderToString(createElement(App))).toBe(html);
  });
});
