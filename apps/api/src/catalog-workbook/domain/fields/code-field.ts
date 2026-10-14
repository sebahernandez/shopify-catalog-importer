import type { FieldValue } from '../workbook-cell.js';
import { type FieldResult, cellReason } from './field-result.js';

const MAX_SAFE_DIGITS = 15;
const PLAIN_DIGITS = /^\d+$/;

/**
 * SKU and barcode cells. Text is kept as typed. A number cell may have lost leading zeros, so it
 * warns; one that cannot be exact (exponent, fraction, 16 or more digits) is blocked.
 */
export function parseCode(
  cell: FieldValue,
): FieldResult<string, 'NUMERIC_IDENTIFIER_UNSAFE', 'NUMERIC_IDENTIFIER_CELL'> {
  if (cell.kind === 'empty') {
    return { ok: true, value: undefined };
  }
  if (cell.kind !== 'text' && cell.kind !== 'number') {
    return { ok: false, reason: cellReason(cell) };
  }
  if (cell.kind === 'text') {
    return { ok: true, value: cell.text };
  }
  const raw = cell.raw;
  if (!PLAIN_DIGITS.test(raw) || raw.length > MAX_SAFE_DIGITS) {
    return { ok: false, reason: 'NUMERIC_IDENTIFIER_UNSAFE' };
  }
  return { ok: true, value: raw, warning: 'NUMERIC_IDENTIFIER_CELL' };
}
