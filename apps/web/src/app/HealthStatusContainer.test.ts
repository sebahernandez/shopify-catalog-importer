import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { es } from '../i18n/es';
import { HealthStatusContainer } from './HealthStatusContainer';

describe('HealthStatusContainer', () => {
  const html = renderToString(createElement(HealthStatusContainer));

  it('shows the loading state until the first answer arrives', () => {
    expect(html).toContain(es.health.states.loading);
    for (const other of ['ok', 'degraded', 'unreachable'] as const) {
      expect(html).not.toContain(es.health.states[other]);
    }
  });

  it('passes its state to the badge: one live region, one decorative dot, no version yet', () => {
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html.match(/aria-hidden="true"/g)).toHaveLength(1);
    expect(html).not.toContain('Versión');
    expect(html).not.toMatch(/undefined|null|\[object/);
  });
});
