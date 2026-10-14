import { describe, expect, it } from 'vitest';
import { buildSheet, type CellSpec, type SheetOptions } from '../../test-support/sheet-builder.js';
import { IssueCollector } from '../issue-collector.js';
import { readRows, reportReadFailure } from './read-rows.js';

const HEADER = ['product_key', 'precio', 'gestionar_inventario'];
const COLUMNS = new Map([
  ['product_key', 1],
  ['precio', 2],
  ['gestionar_inventario', 3],
]);

function run(rows: readonly (readonly CellSpec[])[], options?: SheetOptions) {
  const sink = new IssueCollector(1_000);
  const sheet = buildSheet('Variantes', [HEADER, ...rows], options);
  const result = readRows('Variantes', sheet, COLUMNS, sink);
  return { result, issues: sink.build().issues };
}

const formula = (value: CellSpec & object) => ({ ...value, formula: true });

describe('readRows', () => {
  it('skips blank and whitespace-only rows without shifting row numbers', () => {
    const { result, issues } = run([['A1', 9], [], ['  ', ' '], ['B2', 5]]);
    expect(result.map((row) => row.sourceRow)).toEqual([2, 5]);
    expect(issues).toEqual([]);
  });

  it('gives trimmed cells and leaves absent cells out', () => {
    const { result } = run([[' A1 ', null, true]]);
    expect(result[0]?.cells.get('product_key')).toEqual({ kind: 'text', text: 'A1' });
    expect(result[0]?.cells.has('precio')).toBe(false);
    expect(result[0]?.cells.get('gestionar_inventario')).toEqual({ kind: 'boolean', value: true });
  });

  it.each([
    ['plain', { value: { kind: 'number', raw: '5' } }],
    ['shared', { value: { kind: 'number', raw: '7' } }],
    ['text result', { value: { kind: 'text', text: 'abc' } }],
  ] as const)('reports a %s formula and skips only that cell', (_name, cell) => {
    const { result, issues } = run([['A1', formula(cell), 'si']]);
    expect(issues).toEqual([
      {
        severity: 'error',
        code: 'FORMULA_NOT_ALLOWED',
        sheet: 'Variantes',
        row: 2,
        field: 'precio',
        params: {},
      },
    ]);
    expect(result[0]?.untrusted).toEqual(new Set(['precio']));
    expect(result[0]?.cells.has('precio')).toBe(false);
    expect(result[0]?.cells.has('product_key')).toBe(true);
  });

  it('reports an error cell and a date cell, and marks them untrusted', () => {
    const { result, issues } = run([
      [
        'A1',
        { value: { kind: 'error', code: '#N/A' } },
        { value: { kind: 'date', iso: '2026-01-01' } },
      ],
    ]);
    expect(issues.map((issue) => [issue.code, issue.field])).toEqual([
      ['CELL_ERROR_VALUE', 'precio'],
      ['CELL_TYPE_UNEXPECTED', 'gestionar_inventario'],
    ]);
    expect(result[0]?.untrusted).toEqual(new Set(['precio', 'gestionar_inventario']));
  });

  it('accepts a boolean cell only in gestionar_inventario', () => {
    const { issues } = run([[true, false, true]]);
    expect(issues.map((issue) => [issue.code, issue.field])).toEqual([
      ['CELL_TYPE_UNEXPECTED', 'product_key'],
      ['CELL_TYPE_UNEXPECTED', 'precio'],
    ]);
  });

  it('warns once per kind about hidden content, never about hidden blanks', () => {
    const { issues } = run([['A1', 9], ['B2', 8], [], ['C3', 7]], {
      visibility: 'hidden',
      hiddenRows: [2, 3, 4],
      hiddenCols: [2],
    });
    expect(issues.map((issue) => [issue.code, issue.row, issue.params])).toEqual([
      ['HIDDEN_CONTENT', null, { sheet: 'Variantes', kind: 'columnas' }],
      ['HIDDEN_CONTENT', null, { sheet: 'Variantes', kind: 'filas' }],
      ['HIDDEN_CONTENT', null, { sheet: 'Variantes', kind: 'hoja' }],
    ]);
    expect(issues.every((issue) => issue.severity === 'warning')).toBe(true);
  });
});

describe('reportReadFailure', () => {
  it('reports a sheet cap with the canonical sheet', () => {
    const sink = new IssueCollector(10);
    const finding = {
      code: 'SHEET_ROW_LIMIT_EXCEEDED',
      params: { sheet: ' Imágenes ', limit: 3, actual: 9 },
    } as const;
    reportReadFailure({ ok: false, finding }, sink);
    expect(sink.build().issues).toEqual([
      {
        severity: 'error',
        code: finding.code,
        sheet: 'Imagenes',
        row: null,
        field: null,
        params: finding.params,
      },
    ]);
  });

  it('reports an over-long cell with its sheet and row', () => {
    const sink = new IssueCollector(10);
    const finding = { code: 'CELL_TEXT_TOO_LONG', params: { limit: 5, actual: 9 } } as const;
    reportReadFailure({ ok: false, finding, cell: { sheet: 'Productos', row: 4, col: 3 } }, sink);
    expect(sink.build().issues).toEqual([
      {
        severity: 'error',
        code: finding.code,
        sheet: 'Productos',
        row: 4,
        field: null,
        params: finding.params,
      },
    ]);
  });
});
