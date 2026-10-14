import { COLUMNS, type DataSheet } from '@importer/contracts';
import type { IssueCollector } from '../issue-collector.js';
import { matchKey } from '../match-key.js';
import { normalizeCell, type WorkbookSheet } from '../workbook-cell.js';

export interface ResolvedHeaders {
  /** Canonical column key to 1-based column; a duplicated or unknown header is not mapped. */
  readonly columns: ReadonlyMap<string, number>;
  /** False when a required column is missing or duplicated, so the sheet's rules are skipped. */
  readonly usable: boolean;
}

/** Reads row 1 of a data sheet and maps its headers to canonical column keys. */
export function resolveHeaders(
  sheet: DataSheet,
  workbookSheet: WorkbookSheet,
  sink: IssueCollector,
): ResolvedHeaders {
  const found = new Map<string, number[]>();
  const issue = (
    code: string,
    severity: 'error' | 'warning',
    field: string | null,
    params: Record<string, string>,
  ) => sink.add({ severity, code, sheet, row: 1, field, params: { sheet, ...params } });
  for (const cell of workbookSheet.rows.get(1) ?? []) {
    const value = normalizeCell(cell.value);
    const text = value.kind === 'text' ? value.text : value.kind === 'number' ? value.raw : '';
    if (text === '') continue;
    const column = COLUMNS[sheet].find((candidate) => candidate.key === matchKey(text));
    if (column === undefined) {
      issue('HEADER_UNKNOWN', 'warning', null, { header: text });
    } else {
      found.set(column.key, [...(found.get(column.key) ?? []), cell.col]);
    }
  }
  const columns = new Map<string, number>();
  let usable = true;
  for (const { key, required } of COLUMNS[sheet]) {
    const cols = found.get(key) ?? [];
    const [only] = cols;
    if (cols.length === 1 && only !== undefined) {
      columns.set(key, only);
    } else if (cols.length > 1) {
      issue('HEADER_DUPLICATE', 'error', key, { column: key });
      usable &&= !required;
    } else if (required) {
      issue('HEADER_MISSING', 'error', key, { column: key });
      usable = false;
    }
  }
  return { columns, usable };
}
