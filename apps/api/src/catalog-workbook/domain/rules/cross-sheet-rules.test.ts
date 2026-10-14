import { describe, expect, it } from 'vitest';
import type { ImageRow } from '../image-row.js';
import { IssueCollector } from '../issue-collector.js';
import type { ProductRow } from '../product-row.js';
import type { VariantRow } from '../variant-row.js';
import { crossSheetRules } from './cross-sheet-rules.js';

const product = (sourceRow: number, productKey: string | undefined): ProductRow => ({
  sourceRow,
  productKey,
  handle: undefined,
  title: undefined,
  tags: undefined,
});
const variant = (sourceRow: number, productKey: string | undefined): VariantRow => ({
  sourceRow,
  productKey,
  sku: undefined,
});
const image = (sourceRow: number, productKey: string | undefined): ImageRow => ({
  sourceRow,
  productKey,
  path: undefined,
  order: undefined,
  alt: undefined,
  variantSku: undefined,
});

function run(products: ProductRow[], variants: VariantRow[], images: ImageRow[] = []) {
  const sink = new IssueCollector(100);
  crossSheetRules(products, variants, images, sink);
  return sink.build().issues;
}

const error = (code: string, sheet: string, row: number, field: string | null) => ({
  severity: 'error',
  code,
  sheet,
  row,
  field,
  params: {},
});

describe('crossSheetRules', () => {
  it('accepts rows whose product_key exists in Productos', () => {
    expect(run([product(2, 'P1')], [variant(2, 'P1')], [image(2, 'P1')])).toEqual([]);
  });

  it('blocks a Variantes row whose key is not in Productos', () => {
    const issues = run([product(2, 'P1')], [variant(2, 'P1'), variant(7, 'ZZ')]);
    expect(issues).toEqual([error('PRODUCT_KEY_UNKNOWN', 'Variantes', 7, 'product_key')]);
  });

  it('blocks Imagenes rows with an empty or unknown key', () => {
    const issues = run(
      [product(2, 'P1')],
      [variant(2, 'P1')],
      [image(3, undefined), image(4, 'ZZ')],
    );
    expect(issues).toEqual([
      error('PRODUCT_KEY_UNKNOWN', 'Imagenes', 3, 'product_key'),
      error('PRODUCT_KEY_UNKNOWN', 'Imagenes', 4, 'product_key'),
    ]);
  });

  it('reports a row with an empty key exactly once', () => {
    const issues = run(
      [product(2, 'P1')],
      [variant(2, 'P1'), variant(5, undefined), variant(6, '')],
    );
    expect(issues).toEqual([
      error('PRODUCT_KEY_UNKNOWN', 'Variantes', 5, 'product_key'),
      error('PRODUCT_KEY_UNKNOWN', 'Variantes', 6, 'product_key'),
    ]);
  });

  it('blocks a product without Variantes rows, even with images', () => {
    const issues = run([product(2, 'P1'), product(3, 'P2')], [variant(2, 'P1')], [image(2, 'P2')]);
    expect(issues).toEqual([error('PRODUCT_WITHOUT_VARIANTS', 'Productos', 3, 'product_key')]);
  });

  it('leaves a product row without key to the Productos rule', () => {
    expect(run([product(2, undefined)], [])).toEqual([]);
  });

  it('reports a repeated product key once', () => {
    const issues = run([product(2, 'P1'), product(3, 'P1')], []);
    expect(issues).toEqual([error('PRODUCT_WITHOUT_VARIANTS', 'Productos', 2, 'product_key')]);
  });
});
