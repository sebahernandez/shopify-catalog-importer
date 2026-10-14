import { parseCode } from '../fields/code-field.js';
import type { IssueCollector } from '../issue-collector.js';
import type { SourceRow } from '../structure/read-rows.js';
import type { VariantRow } from '../variant-row.js';

const SHEET = 'Variantes';

/** An earlier row that used a sku, kept to point the duplicate at the first one. */
interface SkuUse {
  readonly row: number;
  readonly productKey: string;
}

/**
 * Checks the identity of Variantes rows: the sku policy (missing, duplicate in a product,
 * duplicate across products) and number cells used as sku. Whether the product_key exists in
 * Productos is a cross-sheet rule. Returns the typed rows; an empty, untrusted or unsafe field
 * is left `undefined`.
 */
export function variantesIdentityRules(
  rows: readonly SourceRow[],
  sink: IssueCollector,
): VariantRow[] {
  const uses = new Map<string, SkuUse[]>();

  return rows.map((source) => {
    const report = (
      severity: 'error' | 'warning',
      code: string,
      params: Record<string, string | number> = {},
    ) => sink.add({ severity, code, sheet: SHEET, row: source.sourceRow, field: 'sku', params });

    const keyCell = source.untrusted.has('product_key')
      ? undefined
      : source.cells.get('product_key');
    const productKey =
      keyCell?.kind === 'text'
        ? keyCell.text.trim()
        : keyCell?.kind === 'number'
          ? keyCell.raw
          : undefined;

    // An untrusted sku was already reported by readRows: it is neither read nor flagged missing.
    if (source.untrusted.has('sku'))
      return { sourceRow: source.sourceRow, productKey, sku: undefined };

    const parsed = parseCode(source.cells.get('sku') ?? { kind: 'empty' });
    // Cell-kind reasons cannot reach here: readRows leaves those cells out and marks them untrusted.
    if (!parsed.ok) {
      if (parsed.reason === 'NUMERIC_IDENTIFIER_UNSAFE') report('error', parsed.reason);
      return { sourceRow: source.sourceRow, productKey, sku: undefined };
    }
    const sku = parsed.value?.trim();
    if (parsed.warning !== undefined) report('warning', parsed.warning);
    if (sku === undefined) {
      report('warning', 'SKU_MISSING');
    } else if (productKey !== undefined) {
      const earlier = uses.get(sku) ?? [];
      const sameProduct = earlier.find((use) => use.productKey === productKey);
      if (sameProduct !== undefined) {
        report('error', 'SKU_DUPLICATE_IN_PRODUCT', { firstRow: sameProduct.row });
      } else if (earlier[0] !== undefined) {
        report('warning', 'SKU_DUPLICATE_ACROSS_PRODUCTS', { firstRow: earlier[0].row });
      }
      uses.set(sku, [...earlier, { row: source.sourceRow, productKey }]);
    }
    return { sourceRow: source.sourceRow, productKey, sku };
  });
}
