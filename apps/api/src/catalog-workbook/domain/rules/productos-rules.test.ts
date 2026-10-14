import { describe, expect, it } from 'vitest';
import { IssueCollector } from '../issue-collector.js';
import type { SourceRow } from '../structure/read-rows.js';
import type { FieldValue } from '../workbook-cell.js';
import { productosRules } from './productos-rules.js';

const text = (value: string): FieldValue => ({ kind: 'text', text: value });

function row(
  sourceRow: number,
  fields: Record<string, string>,
  untrusted: string[] = [],
): SourceRow {
  // Like readRows, an empty cell is simply absent.
  const cells = new Map(
    Object.entries(fields)
      .filter(([, value]) => value !== '')
      .map(([key, value]) => [key, text(value)]),
  );
  return { sourceRow, cells, untrusted: new Set(untrusted) };
}

const valid = { product_key: 'P1', handle: 'camisa-roja', titulo: 'Camisa' };

function run(...rows: SourceRow[]) {
  const sink = new IssueCollector(100);
  const products = productosRules(rows, sink);
  return { products, issues: sink.build().issues };
}

describe('productosRules', () => {
  it('reports an empty titulo as REQUIRED_FIELD_MISSING with sheet, row and field', () => {
    const { issues } = run(row(5, { ...valid, titulo: '' }));
    expect(issues).toEqual([
      {
        severity: 'error',
        code: 'REQUIRED_FIELD_MISSING',
        sheet: 'Productos',
        row: 5,
        field: 'titulo',
        params: { field: 'titulo' },
      },
    ]);
  });

  it('reports a repeated product_key pointing at the first row', () => {
    const { issues } = run(row(2, valid), row(3, { ...valid, handle: 'otra' }));
    expect(issues).toMatchObject([
      { code: 'PRODUCT_KEY_DUPLICATE', row: 3, field: 'product_key', params: { firstRow: 2 } },
    ]);
  });

  it('reports a handle repeated with other casing', () => {
    const { issues } = run(
      row(2, valid),
      row(3, { product_key: 'P2', handle: 'CAMISA-ROJA', titulo: 'x' }),
    );
    expect(issues).toMatchObject([
      { code: 'HANDLE_DUPLICATE', row: 3, field: 'handle', params: { firstRow: 2 } },
    ]);
  });

  it('rejects a handle with spaces and accepts one with digits and hyphens', () => {
    const bad = run(row(2, { ...valid, handle: 'camisa roja' }));
    expect(bad.issues).toMatchObject([{ code: 'HANDLE_INVALID_FORMAT', field: 'handle' }]);
    expect(bad.products[0]?.handle).toBeUndefined();
    const good = run(row(2, { ...valid, handle: 'camisa-roja-2' }));
    expect(good.issues).toEqual([]);
    expect(good.products[0]?.handle).toBe('camisa-roja-2');
  });

  it('warns once for an example product and still reports its defects', () => {
    const clean = run(row(2, { ...valid, product_key: 'ejemplo-remera' }));
    expect(clean.issues).toMatchObject([{ severity: 'warning', code: 'EXAMPLE_PRODUCT', row: 2 }]);
    const broken = run(row(2, { product_key: 'EJEMPLO-REMERA', handle: 'a', titulo: '' }));
    expect(broken.issues.map((issue) => issue.code).sort()).toEqual([
      'EXAMPLE_PRODUCT',
      'REQUIRED_FIELD_MISSING',
    ]);
  });

  it('warns when a tag is over 255 characters or there are more than 250 tags', () => {
    const long = run(row(2, { ...valid, etiquetas: 'x'.repeat(256) }));
    expect(long.issues).toMatchObject([{ severity: 'warning', code: 'TAG_LIMIT_EXCEEDED' }]);
    const many = Array.from({ length: 251 }, (_, index) => `t${index}`).join(',');
    expect(run(row(2, { ...valid, etiquetas: many })).issues).toMatchObject([
      { code: 'TAG_LIMIT_EXCEEDED', field: 'etiquetas' },
    ]);
  });

  it('de-duplicates tags without any issue', () => {
    const { issues, products } = run(row(2, { ...valid, etiquetas: 'a, A, b' }));
    expect(issues).toEqual([]);
    expect(products[0]?.tags).toEqual(['a', 'b']);
  });

  it('skips fields already reported as untrusted', () => {
    const { issues } = run(row(4, { product_key: 'P1', handle: 'h' }, ['titulo']));
    expect(issues).toEqual([]);
  });
});
