import type { FieldValue } from '../workbook-cell.js';
import { type FieldResult, cellReason } from './field-result.js';

export interface IntegerBounds {
  readonly min?: number;
  readonly max?: number;
}

const DIGITS = /^\d+$/;

/** Non-negative whole numbers only; `orden` passes `min: 1`, `stock` passes the 32-bit `max`. */
export function parseInteger(
  cell: FieldValue,
  { min = 0, max = Number.MAX_SAFE_INTEGER }: IntegerBounds = {},
): FieldResult<number, 'INTEGER_INVALID'> {
  if (cell.kind === 'empty') {
    return { ok: true, value: undefined };
  }
  if (cell.kind !== 'text' && cell.kind !== 'number') {
    return { ok: false, reason: cellReason(cell) };
  }
  const digits = cell.kind === 'text' ? cell.text : cell.raw;
  const value = DIGITS.test(digits) ? Number(digits) : NaN;
  return value >= min && value <= max
    ? { ok: true, value }
    : { ok: false, reason: 'INTEGER_INVALID' };
}
