import type { WorkbookSheet } from '../domain/workbook-cell.js';
import type { FileFinding } from '../ports/archive-inspector.port.js';

/**
 * Guards against the two parsers disagreeing: the archive scan saw a formula element in a worksheet
 * part, yet the reader flagged no cell. Per-cell reporting stays with the reader's flags.
 */
export function guardFormulas(
  formulaParts: readonly string[],
  sheets: readonly WorkbookSheet[],
): readonly FileFinding[] {
  if (formulaParts.length === 0) return [];
  const flagged = sheets.some((sheet) =>
    [...sheet.rows.values()].some((row) => row.some((cell) => cell.formula)),
  );
  return flagged ? [] : [{ code: 'FORMULA_NOT_ALLOWED', params: {} }];
}
