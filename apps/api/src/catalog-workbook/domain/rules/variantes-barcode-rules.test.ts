import { describe, expect, it } from 'vitest';
import { IssueCollector } from '../issue-collector.js';
import type { SourceRow } from '../structure/read-rows.js';
import type { VariantRow } from '../variant-row.js';
import type { FieldValue } from '../workbook-cell.js';
import { variantesBarcodeRules } from './variantes-barcode-rules.js';

const text = (value: string): FieldValue => ({ kind: 'text', text: value });
const number = (raw: string): FieldValue => ({ kind: 'number', raw });

/** An empty cell is simply absent, like readRows leaves it. */
function row(barcode: FieldValue | undefined, untrusted: string[] = []): SourceRow {
  const cells = new Map<string, FieldValue>();
  if (barcode !== undefined) cells.set('codigo_barras', barcode);
  return { sourceRow: 2, cells, untrusted: new Set(untrusted) };
}

function run(source: SourceRow) {
  const sink = new IssueCollector(100);
  const variants: VariantRow[] = [{ sourceRow: 2, productKey: 'P1', sku: undefined }];
  const typed = variantesBarcodeRules([source], variants, sink);
  return { typed: typed[0], issues: sink.build().issues };
}

const issue = (severity: 'error' | 'warning', code: string) => ({
  severity,
  code,
  sheet: 'Variantes',
  row: 2,
  field: 'codigo_barras',
  params: {},
});

describe('variantesBarcodeRules', () => {
  it.each([
    ['comma', '7501,7502'],
    ['semicolon', '7501;7502'],
    ['pipe', '7501|7502'],
    ['line break', '7501\n7502'],
    ['inner whitespace', '7501 7502'],
  ])('blocks several barcodes separated by %s', (_name, value) => {
    const { issues, typed } = run(row(text(value)));
    expect(issues).toEqual([issue('error', 'BARCODE_MULTIPLE')]);
    expect(typed?.barcode).toBeUndefined();
  });

  it.each(['1234567890123456', '1.23457E+15'])('blocks the unsafe number cell %s', (raw) => {
    const { issues, typed } = run(row(number(raw)));
    expect(issues).toEqual([issue('error', 'NUMERIC_IDENTIFIER_UNSAFE')]);
    expect(typed?.barcode).toBeUndefined();
  });

  it('warns about a short number cell and keeps the value', () => {
    const { issues, typed } = run(row(number('7501234567890')));
    expect(issues).toEqual([issue('warning', 'NUMERIC_IDENTIFIER_CELL')]);
    expect(typed?.barcode).toBe('7501234567890');
  });

  it('keeps text with leading zeros as typed and silent', () => {
    const { issues, typed } = run(row(text('0012345678905')));
    expect(issues).toEqual([]);
    expect(typed?.barcode).toBe('0012345678905');
  });

  it('accepts an empty barcode without an issue', () => {
    const { issues, typed } = run(row(undefined));
    expect(issues).toEqual([]);
    expect(typed?.barcode).toBeUndefined();
  });

  it('skips an untrusted barcode already reported by readRows', () => {
    expect(run(row(undefined, ['codigo_barras'])).issues).toEqual([]);
  });
});
