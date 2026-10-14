import type { CellValue, WorkbookCell, WorkbookSheet } from '../domain/workbook-cell.js';

/** A cell in a test grid: plain values map to text, number and boolean; `null` leaves a gap. */
export type CellSpec = string | number | boolean | null | { value: CellValue; formula?: boolean };

export interface SheetOptions {
  readonly index?: number;
  readonly visibility?: WorkbookSheet['visibility'];
  readonly hiddenRows?: readonly number[];
  readonly hiddenCols?: readonly number[];
}

function toValue(spec: Exclude<CellSpec, null>): { value: CellValue; formula: boolean } {
  if (typeof spec === 'string') return { value: { kind: 'text', text: spec }, formula: false };
  if (typeof spec === 'number')
    return { value: { kind: 'number', raw: String(spec) }, formula: false };
  if (typeof spec === 'boolean') return { value: { kind: 'boolean', value: spec }, formula: false };
  return { value: spec.value, formula: spec.formula ?? false };
}

/** Builds an in-memory sheet from a grid; grid row 0 is spreadsheet row 1, an empty row is absent. */
export function buildSheet(
  name: string,
  grid: readonly (readonly CellSpec[])[],
  options: SheetOptions = {},
): WorkbookSheet {
  const rows = new Map<number, readonly WorkbookCell[]>();
  grid.forEach((line, rowIndex) => {
    const cells: WorkbookCell[] = [];
    line.forEach((spec, colIndex) => {
      if (spec === null) return;
      const col = colIndex + 1;
      cells.push({
        row: rowIndex + 1,
        col,
        ref: `${String.fromCharCode(64 + col)}${rowIndex + 1}`,
        ...toValue(spec),
      });
    });
    if (cells.length > 0) rows.set(rowIndex + 1, cells);
  });
  return {
    name,
    index: options.index ?? 0,
    visibility: options.visibility ?? 'visible',
    hiddenRows: new Set(options.hiddenRows),
    hiddenCols: new Set(options.hiddenCols),
    rows,
  };
}
