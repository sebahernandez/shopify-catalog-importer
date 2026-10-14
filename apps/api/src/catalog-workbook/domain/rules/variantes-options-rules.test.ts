import { describe, expect, it } from 'vitest';
import { IssueCollector } from '../issue-collector.js';
import type { SourceRow } from '../structure/read-rows.js';
import type { VariantRow } from '../variant-row.js';
import type { FieldValue } from '../workbook-cell.js';
import { variantesOptionsRules } from './variantes-options-rules.js';

const text = (value: string): FieldValue => ({ kind: 'text', text: value });

/** `options` maps a field such as `opcion1_nombre` to its text; an empty cell is simply absent. */
function row(
  sourceRow: number,
  productKey: string | undefined,
  options: Record<string, string> = {},
  untrusted: string[] = [],
): SourceRow {
  const cells = new Map<string, FieldValue>();
  if (productKey !== undefined) cells.set('product_key', text(productKey));
  for (const [field, value] of Object.entries(options)) cells.set(field, text(value));
  return { sourceRow, cells, untrusted: new Set(untrusted) };
}

function run(...rows: SourceRow[]) {
  const sink = new IssueCollector(1000);
  // The identity rule output is only needed for sourceRow and productKey here.
  const variants: VariantRow[] = rows.map((source) => ({
    sourceRow: source.sourceRow,
    productKey: source.cells.get('product_key') === undefined ? undefined : 'P1',
    sku: undefined,
  }));
  const typed = variantesOptionsRules(rows, variants, sink);
  return { typed, issues: sink.build().issues };
}

const talla = (value: string) => ({ opcion1_nombre: 'Talla', opcion1_valor: value });
const codes = (issues: readonly { code: string }[]) => issues.map((issue) => issue.code);

describe('variantesOptionsRules', () => {
  it('accepts a single row with empty options', () => {
    const { issues, typed } = run(row(2, 'P1'));
    expect(issues).toEqual([]);
    expect(typed[0]?.opcion1_nombre).toBeUndefined();
  });

  it('accepts a single row with options and exposes them trimmed', () => {
    const { issues, typed } = run(row(2, 'P1', { ...talla(' M ') }));
    expect(issues).toEqual([]);
    expect(typed[0]).toMatchObject({ opcion1_nombre: 'Talla', opcion1_valor: 'M' });
  });

  it('flags the second row when two rows of a product have no options', () => {
    const { issues } = run(row(2, 'P1'), row(3, 'P1'));
    expect(issues).toEqual([
      {
        severity: 'error',
        code: 'OPTIONS_INCONSISTENT',
        sheet: 'Variantes',
        row: 3,
        field: 'opcion1_nombre',
        params: {},
      },
    ]);
  });

  it('flags row 3 when it names an option differently from row 2', () => {
    const { issues } = run(
      row(2, 'P1', talla('M')),
      row(3, 'P1', { opcion1_nombre: 'Color', opcion1_valor: 'Rojo' }),
    );
    expect(issues).toMatchObject([{ code: 'OPTIONS_INCONSISTENT', row: 3 }]);
  });

  it('compares names case-insensitively and by position', () => {
    const same = run(
      row(2, 'P1', talla('M')),
      row(3, 'P1', { opcion1_nombre: ' TALLA ', opcion1_valor: 'L' }),
    );
    expect(same.issues).toEqual([]);

    const swapped = run(
      row(2, 'P1', { ...talla('M'), opcion2_nombre: 'Color', opcion2_valor: 'Rojo' }),
      row(3, 'P1', {
        opcion1_nombre: 'Color',
        opcion1_valor: 'Rojo',
        opcion2_nombre: 'Talla',
        opcion2_valor: 'M',
      }),
    );
    expect(codes(swapped.issues)).toEqual(['OPTIONS_INCONSISTENT']);
  });

  it('flags the second row of a repeated combination, ignoring case and spaces', () => {
    const { issues } = run(row(2, 'P1', talla('M')), row(3, 'P1', talla(' m ')));
    expect(issues).toMatchObject([
      { severity: 'error', code: 'OPTION_COMBINATION_DUPLICATE', row: 3, params: { firstRow: 2 } },
    ]);
  });

  it('reports a name without value and a value without name', () => {
    const { issues } = run(
      row(2, 'P1', { opcion1_nombre: 'Talla' }),
      row(3, 'P2', { opcion1_valor: 'M' }),
    );
    expect(issues).toMatchObject([
      { code: 'OPTION_INCOMPLETE', row: 2, field: 'opcion1_valor' },
      { code: 'OPTION_INCOMPLETE', row: 3, field: 'opcion1_nombre' },
    ]);
  });

  it('warns once when a product has more than 250 variants', () => {
    const rows = Array.from({ length: 251 }, (_, index) =>
      row(index + 2, 'P1', talla(`v${index}`)),
    );
    const { issues } = run(...rows);
    expect(issues).toMatchObject([
      { severity: 'warning', code: 'VARIANT_COUNT_HIGH', row: 252, params: { count: 251 } },
    ]);
  });

  it('warns about an option value over 255 characters', () => {
    const { issues } = run(row(2, 'P1', talla('x'.repeat(256))));
    expect(issues).toMatchObject([
      { severity: 'warning', code: 'OPTION_VALUE_TOO_LONG', row: 2, field: 'opcion1_valor' },
    ]);
  });

  it('skips untrusted option fields and rows without a product key', () => {
    const { issues, typed } = run(
      row(2, 'P1', talla('M'), ['opcion1_valor']),
      row(3, 'P1', { opcion1_nombre: 'Color', opcion1_valor: 'Rojo' }),
      row(4, undefined, talla('M')),
      row(5, undefined, { opcion1_nombre: 'Color' }),
    );
    expect(issues).toEqual([]);
    expect(typed[0]?.opcion1_valor).toBeUndefined();
  });
});
