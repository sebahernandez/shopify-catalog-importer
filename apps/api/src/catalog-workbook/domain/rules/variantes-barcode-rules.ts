import { parseBarcode } from '../fields/barcode-field.js';
import type { IssueCollector } from '../issue-collector.js';
import type { SourceRow } from '../structure/read-rows.js';
import type { VariantRow } from '../variant-row.js';

const SHEET = 'Variantes';
const FIELD = 'codigo_barras';

/**
 * Checks `codigo_barras` of Variantes rows: one barcode per cell, and a number cell must be exact.
 * A short number cell keeps its value with a warning. A field that readRows already reported
 * (untrusted) is skipped. Returns the rows extended with `barcode`; `undefined` when empty,
 * untrusted or invalid.
 */
export function variantesBarcodeRules(
  rows: readonly SourceRow[],
  variants: readonly VariantRow[],
  sink: IssueCollector,
): VariantRow[] {
  return rows.map((source, index) => {
    const variant = variants[index] as VariantRow;
    if (source.untrusted.has(FIELD)) return { ...variant, barcode: undefined };
    const report = (severity: 'error' | 'warning', code: string) =>
      sink.add({ severity, code, sheet: SHEET, row: source.sourceRow, field: FIELD, params: {} });

    const parsed = parseBarcode(source.cells.get(FIELD) ?? { kind: 'empty' });
    if (!parsed.ok) {
      // Cell-kind reasons cannot reach here: readRows leaves those cells out and marks them untrusted.
      if (parsed.reason !== 'CELL_ERROR_VALUE' && parsed.reason !== 'CELL_TYPE_UNEXPECTED')
        report('error', parsed.reason);
      return { ...variant, barcode: undefined };
    }
    if (parsed.warning !== undefined) report('warning', parsed.warning);
    return { ...variant, barcode: parsed.value };
  });
}
