import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HEALTH_STATES, type HealthState } from '../../health-state';
import { es } from '../../i18n/es';
import { HealthBadge } from './HealthBadge';

function render(state: HealthState, version?: string): string {
  return renderToString(createElement(HealthBadge, { state, version }));
}

// Visible text only: tags removed, entities left as rendered.
function textOf(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

describe('HealthBadge', () => {
  it.each(HEALTH_STATES)('shows the Spanish label for %s as visible text', (state) => {
    expect(textOf(render(state))).toBe(es.health.states[state]);
  });

  it('shows four different labels, one per state', () => {
    const texts = HEALTH_STATES.map((state) => textOf(render(state)));
    expect(new Set(texts).size).toBe(4);
  });

  it.each(HEALTH_STATES)('is a polite live region for %s', (state) => {
    const html = render(state);
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toMatch(/^<div [^>]*role="status"/);
    expect(html).not.toMatch(/aria-live="assertive"/);
  });

  it.each(HEALTH_STATES)(
    'has exactly one decorative dot and no other hidden content for %s',
    (state) => {
      const html = render(state);
      expect(html.match(/aria-hidden="true"/g)).toHaveLength(1);
      expect(html).toMatch(/<span [^>]*aria-hidden="true"[^>]*><\/span>/);
    },
  );

  it('shows the pinned version for ok and degraded when it is given', () => {
    for (const state of ['ok', 'degraded'] as const) {
      expect(textOf(render(state, '2026-10'))).toContain(es.health.version('2026-10'));
      expect(textOf(render(state, '2031-07'))).toContain(es.health.version('2031-07'));
    }
  });

  it('shows no version line when none is given', () => {
    for (const state of HEALTH_STATES) {
      expect(render(state)).not.toContain('Versión');
      expect(render(state, undefined)).not.toContain('Versión');
    }
  });

  it('renders a version as plain text: markup in it is escaped, never interpreted', () => {
    const hostile = '<img src=x onerror=alert(1)><script>alert(2)</script>&"\'';
    const html = render('ok', hostile);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;&amp;&quot;&#x27;');
  });

  it('prints no placeholder artefacts, links, images or inline handlers', () => {
    for (const state of HEALTH_STATES) {
      const html = render(state, '2026-10');
      expect(html).not.toMatch(/undefined|null|\[object/);
      expect(html).not.toMatch(/<(a|img|script|link|iframe|button|input)[\s>]/);
      expect(html).not.toMatch(/\son[a-z]+=|href=|src=/i);
    }
  });

  it('renders the same markup every time', () => {
    expect(render('degraded', '2026-10')).toBe(render('degraded', '2026-10'));
  });
});
