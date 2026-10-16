import { ApiError } from '@importer/contracts';
import { describe, expect, it } from 'vitest';
import type { ApiFailure } from '../api/request';
import { es } from '../i18n/es';
import { failureMessage } from './failure-message';

const API_CODES = ApiError.shape.error.shape.code.options;

const api = (code: (typeof API_CODES)[number] | null, status = 400): ApiFailure => ({
  kind: 'api',
  status,
  code,
  report: null,
});

describe('failureMessage', () => {
  it.each(API_CODES)('has its own Spanish text for the API code %s', (code) => {
    expect(failureMessage(api(code))).toBe(es.errors.api[code]);
    expect(failureMessage(api(code)).trim()).not.toBe('');
  });

  it('gives each API code a different text', () => {
    const texts = API_CODES.map((code) => es.errors.api[code]);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('words the cases the screen can hit by name', () => {
    expect(failureMessage(api('STORE_NOT_CONNECTED', 409))).toMatch(/conectada/);
    expect(failureMessage(api('WORKBOOK_INVALID', 422))).toMatch(/errores/);
    expect(failureMessage(api('SHOPIFY_REQUEST_FAILED', 502))).toMatch(/Shopify/);
    expect(failureMessage(api('STORE_NOT_FOUND', 404))).toMatch(/tienda/);
  });

  it('falls back to a generic message for an unknown answer', () => {
    expect(failureMessage(api(null, 500))).toBe(es.errors.unexpected);
  });

  it.each([
    ['network', { kind: 'network' }, es.errors.network],
    ['timeout', { kind: 'timeout' }, es.errors.timeout],
    ['aborted', { kind: 'aborted' }, es.errors.aborted],
    ['invalid_response', { kind: 'invalid_response', status: 200 }, es.errors.invalidResponse],
  ] as const)('maps %s outside an import', (_name, failure, expected) => {
    expect(failureMessage(failure)).toBe(expected);
  });

  it.each([
    { kind: 'network' },
    { kind: 'timeout' },
    { kind: 'aborted' },
    { kind: 'invalid_response', status: 200 },
    api(null, 502),
  ] as const)('says the outcome is unknown when an import is lost (%o)', (failure) => {
    const text = failureMessage(failure, 'import');
    expect(text).toBe(es.errors.importUnknown);
    expect(text).toMatch(/revisa Shopify/);
  });

  it('keeps a definite import error definite', () => {
    expect(failureMessage(api('STORE_NOT_CONNECTED', 409), 'import')).toBe(
      es.errors.api.STORE_NOT_CONNECTED,
    );
    expect(failureMessage(api(null, 400), 'import')).toBe(es.errors.unexpected);
  });
});
