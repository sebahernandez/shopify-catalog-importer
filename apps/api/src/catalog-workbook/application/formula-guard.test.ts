import { describe, expect, it } from 'vitest';
import type { WorkbookSheet } from '../domain/workbook-cell.js';
import { guardFormulas } from './formula-guard.js';

const sheet = (formula: boolean, name = 'A'): WorkbookSheet => ({
  name,
  index: 0,
  visibility: 'visible',
  hiddenRows: new Set(),
  hiddenCols: new Set(),
  rows: new Map([[2, [{ row: 2, col: 1, ref: 'A2', value: { kind: 'blank' }, formula }]]]),
});

describe('guardFormulas', () => {
  it('adds a file-level FORMULA_NOT_ALLOWED when the archive scan saw formulas the reader did not flag', () => {
    expect(guardFormulas(['xl/worksheets/sheet1.xml'], [sheet(false)])).toEqual([
      { code: 'FORMULA_NOT_ALLOWED', params: {} },
    ]);
  });

  it('adds nothing when both parsers agree there is a formula', () => {
    expect(guardFormulas(['xl/worksheets/sheet1.xml'], [sheet(true, 'Productos')])).toEqual([]);
  });

  it('names the sheet and cell of a formula in a sheet no rule reads', () => {
    const found = guardFormulas(['xl/worksheets/sheet1.xml'], [sheet(true, 'Instrucciones')]);
    expect(found).toEqual([
      { code: 'FORMULA_NOT_ALLOWED', params: { sheet: 'Instrucciones', ref: 'A2' } },
    ]);
  });

  it('reports a formula in an unknown sheet even when a data sheet has one too', () => {
    const sheets = [sheet(true, 'Productos'), sheet(true, 'Notas')];
    expect(guardFormulas(['xl/w.xml'], sheets)).toEqual([
      { code: 'FORMULA_NOT_ALLOWED', params: { sheet: 'Notas', ref: 'A2' } },
    ]);
  });

  it('skips data sheets, whose formulas the reader reports per cell', () => {
    expect(guardFormulas(['xl/w.xml'], [sheet(true, 'Productos')])).toEqual([]);
  });

  it('adds nothing when neither sees a formula', () => {
    expect(guardFormulas([], [sheet(false)])).toEqual([]);
  });
});
