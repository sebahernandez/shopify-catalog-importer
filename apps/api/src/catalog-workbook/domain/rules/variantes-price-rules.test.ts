import { describe, expect, it } from 'vitest';
import { IssueCollector } from '../issue-collector.js';
import type { SourceRow } from '../structure/read-rows.js';
import type { VariantRow } from '../variant-row.js';
import type { FieldValue } from '../workbook-cell.js';
import { variantesPriceRules } from './variantes-price-rules.js';

const text = (value: string): FieldValue => ({ kind: 'text', text: value });
const number = (raw: string): FieldValue => ({ kind: 'number', raw });

/** An empty cell is simply absent, like readRows leaves it. */
function row(
  precio: FieldValue | undefined,
  compare?: FieldValue,
  untrusted: string[] = [],
): SourceRow {
  const cells = new Map<string, FieldValue>();
  if (precio !== undefined) cells.set('precio', precio);
  if (compare !== undefined) cells.set('precio_comparacion', compare);
  return { sourceRow: 2, cells, untrusted: new Set(untrusted) };
}

function run(source: SourceRow) {
  const sink = new IssueCollector(100);
  const variants: VariantRow[] = [{ sourceRow: 2, productKey: 'P1', sku: undefined }];
  const typed = variantesPriceRules([source], variants, sink);
  return { typed: typed[0], issues: sink.build().issues };
}

const issue = (severity: 'error' | 'warning', code: string, field: string, params = {}) => ({
  severity,
  code,
  sheet: 'Variantes',
  row: 2,
  field,
  params,
});

describe('variantesPriceRules', () => {
  it('accepts 1999.9999 exactly', () => {
    const { issues, typed } = run(row(text('1999.9999')));
    expect(issues).toEqual([]);
    expect(typed?.price?.toString()).toBe('1999.9999');
  });

  it('reads a number cell from its stored text', () => {
    const { issues, typed } = run(row(number('0.1')));
    expect(issues).toEqual([]);
    expect(typed?.price?.toString()).toBe('0.1');
  });

  it('blocks a float artifact instead of rounding it', () => {
    const { issues, typed } = run(row(number('0.30000000000000004')));
    expect(issues).toEqual([issue('error', 'DECIMAL_SCALE_EXCEEDED', 'precio')]);
    expect(typed?.price).toBeUndefined();
  });

  it.each([
    ['19,99', 'DECIMAL_AMBIGUOUS'],
    ['1.12345', 'DECIMAL_SCALE_EXCEEDED'],
    ['1000000000000', 'DECIMAL_MAGNITUDE_EXCEEDED'],
    ['1e3', 'DECIMAL_INVALID'],
    ['abc', 'DECIMAL_INVALID'],
    ['-1', 'PRICE_NEGATIVE'],
  ])('reports %s as %s', (value, code) => {
    expect(run(row(text(value))).issues).toEqual([issue('error', code, 'precio')]);
  });

  it('warns about a zero price', () => {
    const { issues, typed } = run(row(text('0')));
    expect(issues).toEqual([issue('warning', 'PRICE_ZERO', 'precio')]);
    expect(typed?.price?.toString()).toBe('0');
  });

  it('requires precio', () => {
    expect(run(row(undefined)).issues).toEqual([
      issue('error', 'REQUIRED_FIELD_MISSING', 'precio', { field: 'precio' }),
    ]);
  });

  it('skips an untrusted precio without a required error', () => {
    expect(run(row(undefined, undefined, ['precio'])).issues).toEqual([]);
  });

  it('warns when compare-at is below price', () => {
    const { issues, typed } = run(row(text('10'), text('8')));
    expect(issues).toEqual([issue('warning', 'COMPARE_AT_BELOW_PRICE', 'precio_comparacion')]);
    expect(typed?.compareAtPrice?.toString()).toBe('8');
  });

  it('accepts a compare-at above price and an empty one', () => {
    expect(run(row(text('10'), text('12'))).issues).toEqual([]);
    expect(run(row(text('10'))).issues).toEqual([]);
  });

  it('reports a bad compare-at on its own field and stays silent on zero', () => {
    expect(run(row(text('10'), text('-2'))).issues).toEqual([
      issue('error', 'PRICE_NEGATIVE', 'precio_comparacion'),
    ]);
    expect(run(row(text('10'), text('0'))).issues).toEqual([
      issue('warning', 'COMPARE_AT_BELOW_PRICE', 'precio_comparacion'),
    ]);
  });
});
