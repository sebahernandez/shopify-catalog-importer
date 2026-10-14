import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { es } from '../i18n/es';
import { App } from './App';

describe('App shell', () => {
  const html = renderToString(createElement(App));

  it('renders one main landmark with the product name as the single level-one heading', () => {
    expect(html.match(/<main[\s>]/g)).toHaveLength(1);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toMatch(/<h1[^>]*>Shopify Catalog Importer<\/h1>/);
  });

  it('has one level-two heading for the status area and no deeper headings', () => {
    expect(html.match(/<h2[\s>]/g)).toHaveLength(1);
    expect(html).toContain(`>${es.health.heading}</h2>`);
    expect(html.match(/<h[3-6][\s>]/g)).toBeNull();
  });

  it('shows the health status, still loading on the server, inside the main landmark', () => {
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain(es.health.states.loading);
    expect(html.indexOf('<main')).toBeLessThan(html.indexOf('role="status"'));
    expect(html.indexOf('role="status"')).toBeLessThan(html.indexOf('</main>'));
  });

  it('no longer carries the under-construction placeholder', () => {
    expect(html).not.toMatch(/construcci[oó]n/);
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
