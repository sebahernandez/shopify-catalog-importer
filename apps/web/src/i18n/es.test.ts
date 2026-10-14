import { describe, expect, it } from 'vitest';
import { HEALTH_STATES } from '../health-state';
import { es } from './es';

describe('Spanish catalog', () => {
  it('keeps the product name exactly as it is', () => {
    expect(es.product).toBe('Shopify Catalog Importer');
  });

  it('has one short, distinct, non-empty label for each of the four health states', () => {
    expect(HEALTH_STATES).toEqual(['loading', 'ok', 'degraded', 'unreachable']);
    const labels = HEALTH_STATES.map((state) => es.health.states[state]);
    expect(new Set(labels).size).toBe(4);
    for (const label of labels) {
      expect(label.trim()).not.toBe('');
      expect(label.length).toBeLessThanOrEqual(80);
    }
  });

  it('words the states factually, without claims the page cannot back', () => {
    expect(es.health.states.loading).toBe('Comprobando el estado de la API…');
    expect(es.health.states.ok).toBe('La API y la base de datos están operativas');
    expect(es.health.states.degraded).toBe(
      'La API responde, pero la base de datos no está disponible',
    );
    expect(es.health.states.unreachable).toBe('No se pudo conectar con la API');
    const all = JSON.stringify(es).toLowerCase();
    for (const claim of ['segur', 'conectad', 'tienda']) expect(all).not.toContain(claim);
  });

  it('builds the version line from the given value only', () => {
    expect(es.health.version('2026-10')).toBe('Versión de la API de Shopify: 2026-10');
    expect(es.health.version('2031-07')).toBe('Versión de la API de Shopify: 2031-07');
  });
});
