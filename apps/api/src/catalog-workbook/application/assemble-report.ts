import { ISSUE_CODES, type ValidationReport, renderIssue } from '@importer/contracts';
import type { CollectedReport } from '../domain/issue-collector.js';
import type { ImageRow } from '../domain/image-row.js';
import type { ProductRow } from '../domain/product-row.js';
import type { VariantRow } from '../domain/variant-row.js';

/** Maps `sheet:row` to the product key typed on that row, so an issue can name its product. */
export function productKeyIndex(
  products: readonly ProductRow[],
  variants: readonly VariantRow[],
  images: readonly ImageRow[],
): ReadonlyMap<string, string> {
  const index = new Map<string, string>();
  const add = (
    sheet: string,
    rows: readonly { sourceRow: number; productKey: string | undefined }[],
  ) =>
    rows.forEach(({ sourceRow, productKey }) => {
      if (productKey !== undefined) index.set(`${sheet}:${sourceRow}`, productKey);
    });
  add('Productos', products);
  add('Variantes', variants);
  add('Imagenes', images);
  return index;
}

/**
 * Turns the collector output into the contracts report. The collector already counted every issue,
 * sorted (file, sheet, row, column, code), kept errors before warnings and cut at the cap, so this
 * step only renders each issue and carries the totals. `fileSha256` arrives computed.
 */
export function assembleReport(
  collected: CollectedReport,
  fileSha256: string,
  productKeys: ReadonlyMap<string, string> = new Map(),
): ValidationReport {
  return {
    valid: collected.errorCount === 0,
    fileSha256,
    summary: { errorCount: collected.errorCount, warningCount: collected.warningCount },
    truncated: collected.truncated,
    issues: collected.issues.map((issue) => {
      const code = ISSUE_CODES.parse(issue.code);
      return {
        severity: issue.severity,
        code,
        params: { ...issue.params },
        sheet: issue.sheet,
        row: issue.row,
        field: issue.field,
        productKey: productKeys.get(`${issue.sheet}:${issue.row}`) ?? null,
        ...renderIssue(code, issue.params),
      };
    }),
  };
}
