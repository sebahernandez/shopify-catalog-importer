import { DATA_SHEETS, type DataSheet } from '@importer/contracts';
import type { ReadResult } from '../../ports/workbook-reader.port.js';
import type { IssueCollector } from '../issue-collector.js';
import { matchKey } from '../match-key.js';
import { type FieldValue, normalizeCell, type WorkbookSheet } from '../workbook-cell.js';

/** One data row as rules see it. A field that is absent from `cells` is empty. */
export interface SourceRow {
  /** Original 1-based spreadsheet row. */
  readonly sourceRow: number;
  readonly cells: ReadonlyMap<string, FieldValue>;
  /** Fields whose cell was already reported (formula, error, wrong kind): rules must skip them. */
  readonly untrusted: ReadonlySet<string>;
}

/** The only field a boolean cell is valid in. */
const BOOLEAN_FIELD = 'gestionar_inventario';

/**
 * Reads the data rows of a sheet through its resolved columns. Blank rows are skipped, keeping
 * the original numbering. Formula, error and wrong-kind cells are reported per cell and left out.
 */
export function readRows(
  sheet: DataSheet,
  workbookSheet: WorkbookSheet,
  columns: ReadonlyMap<string, number>,
  sink: IssueCollector,
): SourceRow[] {
  const rows: SourceRow[] = [];
  const hidden = new Set<string>();
  const report = (code: string, row: number, field: string) =>
    sink.add({ severity: 'error', code, sheet, row, field, params: {} });

  const numbers = [...workbookSheet.rows.keys()].filter((row) => row > 1).sort((a, b) => a - b);
  for (const sourceRow of numbers) {
    const cells = new Map<string, FieldValue>();
    const untrusted = new Set<string>();
    let hasData = false;
    for (const [field, col] of columns) {
      const cell = workbookSheet.rows.get(sourceRow)?.find((candidate) => candidate.col === col);
      if (cell === undefined) continue;
      const value = normalizeCell(cell.value);
      if (!cell.formula && value.kind === 'empty') continue;
      hasData = true;
      if (workbookSheet.hiddenCols.has(col)) hidden.add('columnas');
      if (cell.formula) {
        report('FORMULA_NOT_ALLOWED', sourceRow, field);
      } else if (value.kind === 'error') {
        report('CELL_ERROR_VALUE', sourceRow, field);
      } else if (value.kind === 'date' || (value.kind === 'boolean' && field !== BOOLEAN_FIELD)) {
        report('CELL_TYPE_UNEXPECTED', sourceRow, field);
      } else {
        cells.set(field, value);
        continue;
      }
      untrusted.add(field);
    }
    if (!hasData) continue;
    if (workbookSheet.hiddenRows.has(sourceRow)) hidden.add('filas');
    rows.push({ sourceRow, cells, untrusted });
  }
  if (rows.length > 0 && workbookSheet.visibility !== 'visible') hidden.add('hoja');
  for (const kind of ['columnas', 'filas', 'hoja']) {
    if (hidden.has(kind)) {
      sink.add({
        severity: 'warning',
        code: 'HIDDEN_CONTENT',
        sheet,
        row: null,
        field: null,
        params: { sheet, kind },
      });
    }
  }
  return rows;
}

/** Turns a reader cap failure into an issue; the sheet is the canonical one when it is known. */
export function reportReadFailure(
  failure: Extract<ReadResult, { ok: false }>,
  sink: IssueCollector,
): void {
  const { finding, cell } = failure;
  const written = cell?.sheet ?? finding.params['sheet'];
  sink.add({
    severity: 'error',
    code: finding.code,
    sheet: DATA_SHEETS.find((name) => matchKey(name) === matchKey(String(written))) ?? null,
    row: cell?.row ?? null,
    field: null,
    params: finding.params,
  });
}
