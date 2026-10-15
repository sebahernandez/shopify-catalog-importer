import { checkImagePath } from '../fields/image-path.js';
import { parseInteger } from '../fields/integer-field.js';
import type { ImageRow } from '../image-row.js';
import type { IssueCollector } from '../issue-collector.js';
import type { SourceRow } from '../structure/read-rows.js';
import type { VariantRow } from '../variant-row.js';
import type { FieldValue } from '../workbook-cell.js';

const SHEET = 'Imagenes';
const MAX_ALT_CHARS = 512;
const MAX_IMAGES = 250;

/** A cell as trimmed text; an empty or untrusted cell is `undefined`. */
function textOf(source: SourceRow, field: string): string | undefined {
  const cell: FieldValue | undefined = source.untrusted.has(field)
    ? undefined
    : source.cells.get(field);
  const raw = cell?.kind === 'text' ? cell.text : cell?.kind === 'number' ? cell.raw : '';
  return raw.trim() === '' ? undefined : raw.trim();
}

/**
 * Checks Imagenes rows: the path or URL syntax, a positive unique `orden` per product, the soft `alt` and
 * count limits, and `variant_sku` against the variants of the same product. A row without a
 * product_key is left to the cross-sheet rule, and an untrusted field (already reported by
 * readRows) is skipped. The lowest `orden` of a product is its cover; picking it is the draft's
 * job. `variants` is `undefined` when the Variantes sheet is unusable, and `untrustedSkuProducts`
 * holds the products with a variant whose sku cell was untrusted: in both cases the sheet or cell
 * is already reported, so an unresolved sku is not repeated as unknown. Returns the typed rows; an empty, untrusted or invalid field is left `undefined`.
 */
export function imagenesRules(
  rows: readonly SourceRow[],
  variants: readonly VariantRow[] | undefined,
  sink: IssueCollector,
  untrustedSkuProducts: ReadonlySet<string> = new Set(),
): ImageRow[] {
  const skusByProduct = new Map<string, string[]>();
  for (const { productKey, sku } of variants ?? []) {
    if (productKey === undefined || sku === undefined) continue;
    skusByProduct.set(productKey, [...(skusByProduct.get(productKey) ?? []), sku.trim()]);
  }
  /** Per product: the first row of each order, the image count and the first row over the limit. */
  const orders = new Map<string, Map<number, number>>();
  const counts = new Map<string, { total: number; overflowRow: number }>();

  const typed = rows.map((source): ImageRow => {
    const productKey = textOf(source, 'product_key');
    const report = (
      severity: 'error' | 'warning',
      code: string,
      field: string,
      params: Record<string, string | number> = {},
    ) => sink.add({ severity, code, sheet: SHEET, row: source.sourceRow, field, params });

    let path: string | undefined;
    let kind: ImageRow['kind'];
    if (!source.untrusted.has('archivo')) {
      const checked = checkImagePath(textOf(source, 'archivo') ?? '');
      if (checked.ok) {
        path = checked.path;
        kind = checked.kind;
      } else report('error', 'IMAGE_PATH_INVALID', 'archivo', { reason: checked.reason });
    }

    let order: number | undefined;
    if (!source.untrusted.has('orden')) {
      // Cell-kind reasons cannot reach here: readRows leaves those cells out and marks them untrusted.
      const parsed = parseInteger(source.cells.get('orden') ?? { kind: 'empty' }, { min: 1 });
      if (parsed.ok && parsed.value !== undefined) order = parsed.value;
      else report('error', 'IMAGE_ORDER_INVALID', 'orden');
    }

    const alt = textOf(source, 'alt');
    if (alt !== undefined && alt.length > MAX_ALT_CHARS) report('warning', 'ALT_TOO_LONG', 'alt');

    const wanted = textOf(source, 'variant_sku');
    let variantSku: string | undefined;
    if (variants !== undefined && productKey !== undefined && wanted !== undefined) {
      const matches = (skusByProduct.get(productKey) ?? []).filter((sku) => sku === wanted);
      if (matches.length === 1) variantSku = wanted;
      else if (matches.length > 0 || !untrustedSkuProducts.has(productKey))
        report(
          'error',
          matches.length === 0 ? 'VARIANT_SKU_UNKNOWN' : 'VARIANT_SKU_AMBIGUOUS',
          'variant_sku',
        );
    }

    if (productKey !== undefined) {
      const seen = counts.get(productKey) ?? { total: 0, overflowRow: 0 };
      seen.total += 1;
      if (seen.total === MAX_IMAGES + 1) seen.overflowRow = source.sourceRow;
      counts.set(productKey, seen);
      if (order !== undefined) {
        const firstRows = orders.get(productKey) ?? new Map<number, number>();
        const first = firstRows.get(order);
        if (first === undefined) firstRows.set(order, source.sourceRow);
        else report('error', 'IMAGE_ORDER_DUPLICATE', 'orden', { firstRow: first });
        orders.set(productKey, firstRows);
      }
    }
    return { sourceRow: source.sourceRow, productKey, path, kind, order, alt, variantSku };
  });

  for (const { total, overflowRow } of counts.values()) {
    if (total <= MAX_IMAGES) continue;
    sink.add({
      severity: 'warning',
      code: 'IMAGE_COUNT_HIGH',
      sheet: SHEET,
      row: overflowRow,
      field: null,
      params: { count: total },
    });
  }
  return typed;
}
