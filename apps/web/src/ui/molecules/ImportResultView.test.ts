import { IMPORT_FAILURE_CODES } from '@importer/contracts';
import { describe, expect, it } from 'vitest';
import { es } from '../../i18n/es';
import { importResponse } from '../../test-fixtures';
import { render, textOf } from '../ui-render';
import { ImportResultView } from './ImportResultView';

describe('ImportResultView', () => {
  const text = textOf(render(ImportResultView, { response: importResponse() }));

  it('shows the totals', () => {
    expect(text).toContain(es.import.totals.products);
    expect(text).toMatch(/Productos 2 Creados 1 Fallidos 1/);
  });

  it('lists a created product with its Shopify id and handle', () => {
    expect(text).toContain(es.import.created);
    expect(text).toContain(es.import.productId('gid://shopify/Product/1'));
    expect(text).toContain(es.import.shopifyHandle('camisa-roja-1'));
    expect(text).toContain(es.import.media('subida'));
  });

  it('lists a failed product with Spanish copy for its code, never the raw server message', () => {
    expect(text).toContain(es.import.failures.HANDLE_TAKEN);
    expect(text).toContain('handle: TAKEN');
    expect(text).not.toContain('taken ');
  });

  it('warns visibly about skipped local images', () => {
    expect(text).toContain(es.import.imagesSkippedLocal(2));
  });

  it('explains the draft status and that re-running is not idempotent', () => {
    expect(text).toContain(es.import.draftNote);
    expect(text).toContain(es.import.repeatWarning);
  });

  it('sums skipped images over all products and hides the warning when none were skipped', () => {
    const clean = importResponse({
      totals: { products: 1, created: 1, failed: 0 },
      results: [
        {
          status: 'created',
          productKey: 'a',
          handle: 'a',
          productId: 'gid://shopify/Product/9',
          shopifyHandle: 'a',
          mediaStatuses: [],
          imagesSkipped: { localFile: 0, overLimit: 0 },
          warnings: ['W1'],
        },
      ],
    });
    const out = textOf(render(ImportResultView, { response: clean }));
    expect(out).toContain(es.import.allCreated);
    expect(out).not.toContain('Imágenes de archivo local');
    expect(out).toContain(es.import.warnings('W1'));
  });

  it('shows the early stop as an alert', () => {
    const html = render(ImportResultView, {
      response: importResponse({ stoppedEarly: true }),
    });
    expect(textOf(html)).toContain(es.import.stoppedEarly);
    expect(html).toContain('role="alert"');
  });

  it.each(IMPORT_FAILURE_CODES.options)('renders a failed product with code %s', (code) => {
    const response = importResponse({
      totals: { products: 1, created: 0, failed: 1 },
      results: [
        {
          status: 'failed',
          productKey: 'k',
          handle: 'h',
          failure: { code, message: 'server text', details: [] },
        },
      ],
    });
    const out = textOf(render(ImportResultView, { response }));
    expect(out).toContain(es.import.failures[code]);
    expect(out).not.toContain('server text');
  });
});
