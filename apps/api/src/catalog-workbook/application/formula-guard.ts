import { DATA_SHEETS } from '@importer/contracts';
import { matchKey } from '../domain/match-key.js';
import type { WorkbookSheet } from '../domain/workbook-cell.js';
import type { FileFinding } from '../ports/archive-inspector.port.js';

/**
 * Blocks formulas the per-cell rules never see. A formula in a sheet that is not a data sheet
 * (Instrucciones or an unknown one) is never read by readRows, so it is reported here with its
 * sheet and cell. When the archive scan saw a formula element yet the reader flagged no cell
 * anywhere (the two parsers disagree), one coarse file-level finding covers it. Formulas in data
 * sheets stay with the reader's per-cell flags.
 */
export function guardFormulas(
  formulaParts: readonly string[],
  sheets: readonly WorkbookSheet[],
): readonly FileFinding[] {
  if (formulaParts.length === 0) return [];
  const unread = sheets.filter(
    (sheet) => !DATA_SHEETS.some((name) => matchKey(name) === matchKey(sheet.name)),
  );
  const cells = unread.flatMap((sheet) =>
    [...sheet.rows.values()].flatMap((row) =>
      row
        .filter((cell) => cell.formula)
        .map((cell): FileFinding => ({
          code: 'FORMULA_NOT_ALLOWED',
          params: { sheet: sheet.name, ref: cell.ref },
        })),
    ),
  );
  if (cells.length > 0) return cells;
  const flagged = sheets.some((sheet) =>
    [...sheet.rows.values()].some((row) => row.some((cell) => cell.formula)),
  );
  return flagged ? [] : [{ code: 'FORMULA_NOT_ALLOWED', params: {} }];
}
