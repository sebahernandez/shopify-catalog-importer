import type { FieldValue } from '../workbook-cell.js';
import { parseCode } from './code-field.js';
import type { FieldResult } from './field-result.js';

const SEPARATORS = /[,;|\s]/;

/** One barcode per cell: the identifier rules plus a check for several values in one text. */
export function parseBarcode(
  cell: FieldValue,
): FieldResult<
  string,
  'BARCODE_MULTIPLE' | 'NUMERIC_IDENTIFIER_UNSAFE',
  'NUMERIC_IDENTIFIER_CELL'
> {
  if (cell.kind === 'text' && SEPARATORS.test(cell.text)) {
    return { ok: false, reason: 'BARCODE_MULTIPLE' };
  }
  return parseCode(cell);
}
