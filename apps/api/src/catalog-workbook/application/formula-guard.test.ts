import { describe, expect, it } from 'vitest';
import type { WorkbookSheet } from '../domain/workbook-cell.js';
import { guardFormulas } from './formula-guard.js';

const sheet = (formula: boolean): WorkbookSheet => ({
  name: 'A',
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
    expect(guardFormulas(['xl/worksheets/sheet1.xml'], [sheet(true)])).toEqual([]);
  });

  it('adds nothing when neither sees a formula', () => {
    expect(guardFormulas([], [sheet(false)])).toEqual([]);
  });
});
