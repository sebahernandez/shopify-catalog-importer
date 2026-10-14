import type { ImageRow } from '../image-row.js';
import type { IssueCollector } from '../issue-collector.js';
import type { ProductRow } from '../product-row.js';
import type { VariantRow } from '../variant-row.js';

/**
 * Checks the references between sheets. A Variantes or Imagenes row whose product_key is empty or
 * absent from Productos is `PRODUCT_KEY_UNKNOWN`; this is the only place those rows are reported,
 * so earlier rules skip them silently. A product without any Variantes row is
 * `PRODUCT_WITHOUT_VARIANTS` (once per key; a Productos row without key is the Productos rule's).
 */
export function crossSheetRules(
  products: readonly ProductRow[],
  variants: readonly VariantRow[],
  images: readonly ImageRow[],
  sink: IssueCollector,
): void {
  const known = new Set(products.flatMap(({ productKey }) => productKey ?? []));
  const report = (code: string, sheet: 'Productos' | 'Variantes' | 'Imagenes', row: number) =>
    sink.add({ severity: 'error', code, sheet, row, field: 'product_key', params: {} });

  const used = new Set<string>();
  const check = (sheet: 'Variantes' | 'Imagenes', rows: readonly (VariantRow | ImageRow)[]) => {
    for (const { sourceRow, productKey } of rows) {
      if (productKey !== undefined && known.has(productKey)) {
        if (sheet === 'Variantes') used.add(productKey);
      } else report('PRODUCT_KEY_UNKNOWN', sheet, sourceRow);
    }
  };
  check('Variantes', variants);
  check('Imagenes', images);

  const reported = new Set<string>();
  for (const { sourceRow, productKey } of products) {
    if (productKey === undefined || used.has(productKey) || reported.has(productKey)) continue;
    reported.add(productKey);
    report('PRODUCT_WITHOUT_VARIANTS', 'Productos', sourceRow);
  }
}
