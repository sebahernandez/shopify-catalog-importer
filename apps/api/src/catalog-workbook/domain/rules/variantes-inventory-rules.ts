import { parseBoolean } from '../fields/boolean-field.js';
import { parseInteger } from '../fields/integer-field.js';
import type { IssueCollector } from '../issue-collector.js';
import type { SourceRow } from '../structure/read-rows.js';
import type { VariantRow } from '../variant-row.js';

const SHEET = 'Variantes';
const MAX_STOCK = 2_147_483_647;

/**
 * Checks `gestionar_inventario`, `stock` and `ubicacion` of Variantes rows. An empty flag is false
 * when stock is empty and required when there is stock; a managed row needs stock and a location.
 * A field that readRows already reported (untrusted) is skipped, and so are the checks that
 * depend on it. Returns the rows extended with `manageInventory`, `stock` and `location`; each is
 * `undefined` when empty, untrusted, invalid or (for the flag) not decidable.
 */
export function variantesInventoryRules(
  rows: readonly SourceRow[],
  variants: readonly VariantRow[],
  sink: IssueCollector,
): VariantRow[] {
  return rows.map((source, index) => {
    const variant = variants[index] as VariantRow;
    const report = (code: string, field: string, params: Record<string, string> = {}) =>
      sink.add({ severity: 'error', code, sheet: SHEET, row: source.sourceRow, field, params });
    const cell = (field: string) => source.cells.get(field) ?? { kind: 'empty' as const };
    const trusted = (field: string) => !source.untrusted.has(field);

    // Cell-kind reasons cannot reach here: readRows leaves those cells out and marks them untrusted.
    let stock: number | undefined;
    let stockBad = false;
    if (trusted('stock')) {
      const parsed = parseInteger(cell('stock'), { max: MAX_STOCK });
      if (parsed.ok) stock = parsed.value;
      else {
        stockBad = true;
        report('STOCK_INVALID', 'stock');
      }
    }

    let manageInventory: boolean | undefined;
    if (trusted('gestionar_inventario')) {
      const parsed = parseBoolean(cell('gestionar_inventario'));
      if (!parsed.ok) report('BOOLEAN_INVALID', 'gestionar_inventario');
      else if (parsed.value !== undefined) manageInventory = parsed.value;
      else if (stock !== undefined) report('INVENTORY_FLAG_REQUIRED', 'gestionar_inventario');
      else if (trusted('stock') && !stockBad) manageInventory = false;
    }

    const place = trusted('ubicacion') ? cell('ubicacion') : undefined;
    const raw = place?.kind === 'text' ? place.text : place?.kind === 'number' ? place.raw : '';
    const location = raw.trim() === '' ? undefined : raw.trim();
    if (manageInventory === true) {
      if (stock === undefined && trusted('stock') && !stockBad) report('STOCK_INVALID', 'stock');
      if (location === undefined && trusted('ubicacion'))
        report('REQUIRED_FIELD_MISSING', 'ubicacion', { field: 'ubicacion' });
    }
    return { ...variant, manageInventory, stock, location };
  });
}
