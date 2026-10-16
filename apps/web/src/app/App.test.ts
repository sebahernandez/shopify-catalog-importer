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

  it('has the three wizard steps and the status area as level-two headings', () => {
    expect(html.match(/<h2[\s>]/g)).toHaveLength(4);
    for (const heading of [
      es.stores.heading,
      es.file.heading,
      es.import.heading,
      es.health.heading,
    ]) {
      expect(html).toContain(`>${heading}</h2>`);
    }
    expect(html.match(/<h[4-6][\s>]/g)).toBeNull();
  });

  it('shows the health status, still loading on the server, inside the main landmark', () => {
    expect(html).toContain(es.health.states.loading);
    const health = html.indexOf(es.health.states.loading);
    expect(html.indexOf('<main')).toBeLessThan(health);
    expect(health).toBeLessThan(html.indexOf('</main>'));
  });

  it('starts at the store step, with the file and import steps locked', () => {
    expect(html).toContain(es.wizard.locked.file);
    expect(html).toContain(es.wizard.locked.import);
    expect(html).toContain(es.stores.loading);
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
