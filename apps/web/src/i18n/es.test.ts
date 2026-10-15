import {
  ApiError,
  AUTH_KINDS,
  IMPORT_FAILURE_CODES,
  IMPORT_MEDIA_STATUSES,
  STORE_STATUSES,
  ShopifyErrorKind,
} from '@importer/contracts';
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
    const all = JSON.stringify(es.health).toLowerCase();
    for (const claim of ['segur', 'conectad', 'tienda']) expect(all).not.toContain(claim);
  });

  it('builds the version line from the given value only', () => {
    expect(es.health.version('2026-10')).toBe('Versión de la API de Shopify: 2026-10');
    expect(es.health.version('2031-07')).toBe('Versión de la API de Shopify: 2031-07');
  });

  describe('wizard copy completeness', () => {
    const allText = (value: unknown): string[] =>
      typeof value === 'string'
        ? [value]
        : typeof value === 'object' && value !== null
          ? Object.values(value).flatMap(allText)
          : [];

    it('has Spanish text for every import failure code, and no code is missing or extra', () => {
      expect(Object.keys(es.import.failures).sort()).toEqual(
        [...IMPORT_FAILURE_CODES.options].sort(),
      );
      for (const code of IMPORT_FAILURE_CODES.options) {
        expect(es.import.failures[code].trim(), code).not.toBe('');
      }
      expect(IMPORT_FAILURE_CODES.options).toEqual([
        'SHOPIFY_REJECTED',
        'HANDLE_TAKEN',
        'LOCATION_NOT_FOUND',
        'LOCATION_AMBIGUOUS',
        'LOCATION_REQUIRED',
        'TOO_MANY_VARIANTS',
        'PRODUCT_INVALID',
        'SHOPIFY_ERROR',
        'STORE_ACCESS_FAILED',
        'THROTTLED',
        'OUTCOME_UNKNOWN',
        'NOT_ATTEMPTED',
      ]);
    });

    it('has Spanish text for every API error code', () => {
      expect(Object.keys(es.errors.api).sort()).toEqual(
        [...ApiError.shape.error.shape.code.options].sort(),
      );
    });

    it('has text for every store status, auth kind, media status and verification problem', () => {
      expect(Object.keys(es.stores.statuses).sort()).toEqual([...STORE_STATUSES.options].sort());
      expect(Object.keys(es.stores.authKinds).sort()).toEqual([...AUTH_KINDS.options].sort());
      expect(Object.keys(es.import.mediaStatuses).sort()).toEqual(
        [...IMPORT_MEDIA_STATUSES.options].sort(),
      );
      expect(Object.keys(es.verification.problems).sort()).toEqual(
        [...ShopifyErrorKind.options, 'API_VERSION_MISMATCH', 'CREDENTIALS_UNREADABLE'].sort(),
      );
    });

    it('holds no empty text and no raw code placeholder', () => {
      for (const text of allText(es)) {
        expect(text.trim()).not.toBe('');
        expect(text).not.toMatch(/undefined|null|\[object|\$\{/);
      }
    });

    it('explains that products are drafts and that a second run reports taken handles', () => {
      expect(es.import.draftNote).toMatch(/borrador \(DRAFT\)/);
      expect(es.import.repeatWarning).toMatch(/no es idempotente/);
      expect(es.import.repeatWarning).toMatch(/ya existan/);
    });

    it('warns visibly about images from local files, singular and plural', () => {
      expect(es.import.imagesSkippedLocal(1)).toMatch(/Imágenes de archivo local no se importan/);
      expect(es.import.imagesSkippedLocal(3)).toMatch(/3 imágenes/);
    });

    it('tells the user not to close the window while importing', () => {
      expect(es.import.running).toBe('Importando, no cierres la ventana');
    });

    it('describes where an issue is, with whatever parts are known', () => {
      expect(es.file.location('Productos', 4, 'titulo')).toBe(
        'Hoja Productos, fila 4, columna titulo',
      );
      expect(es.file.location(null, null, null)).toBe('Archivo completo');
      expect(es.file.location('Variantes', null, null)).toBe('Hoja Variantes');
    });

    it('pluralises the counts', () => {
      expect(es.file.errorCount(1)).toBe('1 error');
      expect(es.file.errorCount(2)).toBe('2 errores');
      expect(es.file.warningCount(1)).toBe('1 advertencia');
      expect(es.file.warningCount(0)).toBe('0 advertencias');
    });
  });
});
