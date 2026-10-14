import { EXAMPLE_PREFIX } from '@importer/contracts';
import { parseTags } from '../fields/tags-field.js';
import type { IssueCollector } from '../issue-collector.js';
import type { ProductRow } from '../product-row.js';
import type { SourceRow } from '../structure/read-rows.js';
import type { FieldValue } from '../workbook-cell.js';

const SHEET = 'Productos';
const HANDLE_FORMAT = /^[A-Za-z0-9-]+$/;

/** The text of a cell that can hold plain text; numbers keep their exact stored text. */
function textOf(cell: FieldValue | undefined): string | undefined {
  if (cell?.kind === 'text') return cell.text;
  return cell?.kind === 'number' ? cell.raw : undefined;
}

/**
 * Checks required fields, duplicate keys and handles, handle format, example rows and tag limits.
 * Returns the typed rows; a field that is empty, untrusted or invalid is left `undefined`.
 */
export function productosRules(rows: readonly SourceRow[], sink: IssueCollector): ProductRow[] {
  const firstKeyRow = new Map<string, number>();
  const firstHandleRow = new Map<string, number>();

  return rows.map((source) => {
    const report = (
      severity: 'error' | 'warning',
      code: string,
      field: string,
      params: Record<string, string | number> = {},
    ) => sink.add({ severity, code, sheet: SHEET, row: source.sourceRow, field, params });
    // Untrusted fields were already reported by readRows: they are neither read nor required.
    const read = (field: string) =>
      source.untrusted.has(field) ? undefined : textOf(source.cells.get(field));
    const required = (field: string) => {
      const value = read(field);
      if (value === undefined && !source.untrusted.has(field)) {
        report('error', 'REQUIRED_FIELD_MISSING', field, { field });
      }
      return value;
    };

    const productKey = required('product_key');
    let handle = required('handle');
    const title = required('titulo');

    if (productKey !== undefined) {
      const first = firstKeyRow.get(productKey);
      if (first === undefined) {
        firstKeyRow.set(productKey, source.sourceRow);
      } else {
        report('error', 'PRODUCT_KEY_DUPLICATE', 'product_key', { firstRow: first });
      }
      if (productKey.toLowerCase().startsWith(EXAMPLE_PREFIX.toLowerCase())) {
        report('warning', 'EXAMPLE_PRODUCT', 'product_key');
      }
    }

    if (handle !== undefined) {
      const first = firstHandleRow.get(handle.toLowerCase());
      if (!HANDLE_FORMAT.test(handle)) {
        report('error', 'HANDLE_INVALID_FORMAT', 'handle');
        handle = undefined;
      } else if (first === undefined) {
        firstHandleRow.set(handle.toLowerCase(), source.sourceRow);
      } else {
        report('error', 'HANDLE_DUPLICATE', 'handle', { firstRow: first });
      }
    }

    let tags: string[] | undefined;
    if (!source.untrusted.has('etiquetas')) {
      const parsed = parseTags(source.cells.get('etiquetas') ?? { kind: 'empty' });
      if (parsed.ok) {
        tags = parsed.value;
        if (parsed.warning !== undefined) report('warning', parsed.warning, 'etiquetas');
      }
    }

    return { sourceRow: source.sourceRow, productKey, handle, title, tags };
  });
}
