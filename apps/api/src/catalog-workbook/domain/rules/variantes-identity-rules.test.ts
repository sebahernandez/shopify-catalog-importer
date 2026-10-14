import { describe, expect, it } from 'vitest';
import { IssueCollector } from '../issue-collector.js';
import type { SourceRow } from '../structure/read-rows.js';
import type { FieldValue } from '../workbook-cell.js';
import { variantesIdentityRules } from './variantes-identity-rules.js';

const text = (value: string): FieldValue => ({ kind: 'text', text: value });
const number = (raw: string): FieldValue => ({ kind: 'number', raw });

function row(
  sourceRow: number,
  productKey: string,
  sku: FieldValue | undefined,
  untrusted: string[] = [],
): SourceRow {
  // Like readRows, an empty cell is simply absent.
  const cells = new Map<string, FieldValue>([['product_key', text(productKey)]]);
  if (sku !== undefined) cells.set('sku', sku);
  return { sourceRow, cells, untrusted: new Set(untrusted) };
}

function run(...rows: SourceRow[]) {
  const sink = new IssueCollector(100);
  const variants = variantesIdentityRules(rows, sink);
  return { variants, issues: sink.build().issues };
}

describe('variantesIdentityRules', () => {
  it('warns about an empty sku and nothing else', () => {
    const { issues, variants } = run(row(2, 'P1', undefined));
    expect(issues).toEqual([
      {
        severity: 'warning',
        code: 'SKU_MISSING',
        sheet: 'Variantes',
        row: 2,
        field: 'sku',
        params: {},
      },
    ]);
    expect(variants).toEqual([{ sourceRow: 2, productKey: 'P1', sku: undefined }]);
  });

  it('reports a sku repeated inside one product as an error pointing at the first row', () => {
    const { issues } = run(row(2, 'P1', text('A-1')), row(3, 'P1', text('A-1')));
    expect(issues).toEqual([
      {
        severity: 'error',
        code: 'SKU_DUPLICATE_IN_PRODUCT',
        sheet: 'Variantes',
        row: 3,
        field: 'sku',
        params: { firstRow: 2 },
      },
    ]);
  });

  it('warns about a sku repeated across products', () => {
    const { issues } = run(row(2, 'P1', text('A-1')), row(3, 'P2', text('A-1')));
    expect(issues).toMatchObject([
      {
        severity: 'warning',
        code: 'SKU_DUPLICATE_ACROSS_PRODUCTS',
        row: 3,
        params: { firstRow: 2 },
      },
    ]);
  });

  it('compares trimmed text and groups by the trimmed product_key', () => {
    const { issues } = run(row(2, 'P1', text('A-1')), row(3, ' P1 ', text(' A-1 ')));
    expect(issues).toMatchObject([{ code: 'SKU_DUPLICATE_IN_PRODUCT', row: 3 }]);
  });

  it('warns about a number cell and keeps its raw digits', () => {
    const { issues, variants } = run(row(2, 'P1', number('12345')));
    expect(issues).toMatchObject([
      { severity: 'warning', code: 'NUMERIC_IDENTIFIER_CELL', field: 'sku' },
    ]);
    expect(variants[0]?.sku).toBe('12345');
  });

  it('blocks a number cell with 16 digits or an exponent and drops the sku', () => {
    for (const raw of ['1234567890123456', '1.23457E+15']) {
      const { issues, variants } = run(row(2, 'P1', number(raw)));
      expect(issues).toMatchObject([{ severity: 'error', code: 'NUMERIC_IDENTIFIER_UNSAFE' }]);
      expect(variants[0]?.sku).toBeUndefined();
    }
  });

  it('keeps leading zeros of a text cell without any issue', () => {
    const { issues, variants } = run(row(2, 'P1', text('00123')));
    expect(issues).toEqual([]);
    expect(variants[0]?.sku).toBe('00123');
  });

  it('skips an untrusted sku: no missing warning, no duplicate check', () => {
    const { issues, variants } = run(row(2, 'P1', text('A-1')), row(3, 'P1', text('A-1'), ['sku']));
    expect(issues).toEqual([]);
    expect(variants[1]?.sku).toBeUndefined();
  });
});
