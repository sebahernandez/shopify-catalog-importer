import type { Money } from '../../../shared-kernel/money/money.js';
import { parseDecimal } from '../fields/decimal-field.js';
import type { IssueCollector } from '../issue-collector.js';
import type { SourceRow } from '../structure/read-rows.js';
import type { VariantRow } from '../variant-row.js';

const SHEET = 'Variantes';

/**
 * Checks `precio` and `precio_comparacion` of Variantes rows through `Money`: nothing is rounded.
 * `precio` is required, a zero price and a compare-at below the price are warnings. A field that
 * readRows already reported (untrusted) is skipped. Returns the rows extended with both amounts;
 * an amount is `undefined` when empty, untrusted or invalid.
 */
export function variantesPriceRules(
  rows: readonly SourceRow[],
  variants: readonly VariantRow[],
  sink: IssueCollector,
): VariantRow[] {
  return rows.map((source, index) => {
    const variant = variants[index] as VariantRow;
    const report = (
      severity: 'error' | 'warning',
      code: string,
      field: string,
      params: Record<string, string | number> = {},
    ) => sink.add({ severity, code, sheet: SHEET, row: source.sourceRow, field, params });

    /** Parses one amount field and reports its issues; `undefined` when there is no valid value. */
    const amount = (field: string, required: boolean): Money | undefined => {
      if (source.untrusted.has(field)) return undefined;
      const parsed = parseDecimal(source.cells.get(field) ?? { kind: 'empty' });
      // Cell-kind reasons cannot reach here: readRows leaves those cells out and marks them untrusted.
      if (!parsed.ok) {
        if (parsed.reason !== 'CELL_ERROR_VALUE' && parsed.reason !== 'CELL_TYPE_UNEXPECTED')
          report('error', parsed.reason, field);
        return undefined;
      }
      if (parsed.value === undefined && required)
        report('error', 'REQUIRED_FIELD_MISSING', field, { field });
      // A zero compare-at is not worth a warning of its own: it only matters against the price.
      if (parsed.warning !== undefined && field === 'precio')
        report('warning', parsed.warning, field);
      return parsed.value;
    };

    const price = amount('precio', true);
    const compareAtPrice = amount('precio_comparacion', false);
    if (price !== undefined && compareAtPrice !== undefined && compareAtPrice.compare(price) < 0)
      report('warning', 'COMPARE_AT_BELOW_PRICE', 'precio_comparacion');
    return { ...variant, price, compareAtPrice };
  });
}
