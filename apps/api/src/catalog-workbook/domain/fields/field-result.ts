import type { FieldValue } from '../workbook-cell.js';

export type CellReason = 'CELL_ERROR_VALUE' | 'CELL_TYPE_UNEXPECTED';

/**
 * Outcome of a field parser. An empty cell is `ok` with no value (a rule decides whether the
 * field is required); a warning keeps the value. Reasons are plain codes, mapped to report issues
 * by the rules.
 */
export type FieldResult<T, R extends string, W extends string = never> =
  { ok: true; value: T | undefined; warning?: W } | { ok: false; reason: R | CellReason };

/** Why a cell of this kind can never hold the field: an error value, or any other wrong kind. */
export function cellReason(cell: FieldValue): CellReason {
  return cell.kind === 'error' ? 'CELL_ERROR_VALUE' : 'CELL_TYPE_UNEXPECTED';
}
