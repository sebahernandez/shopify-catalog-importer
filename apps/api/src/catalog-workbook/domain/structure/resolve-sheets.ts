import { DATA_SHEETS, type DataSheet } from '@importer/contracts';
import type { IssueCollector } from '../issue-collector.js';
import { matchKey } from '../match-key.js';
import type { WorkbookSheet } from '../workbook-cell.js';

/**
 * Maps each data sheet to its workbook sheet by normalized name. Colliding names and missing
 * sheets are reported once and the sheet is left out; any other sheet is ignored.
 */
export function resolveSheets(
  sheets: readonly WorkbookSheet[],
  sink: IssueCollector,
): ReadonlyMap<DataSheet, WorkbookSheet> {
  const resolved = new Map<DataSheet, WorkbookSheet>();
  for (const sheet of DATA_SHEETS) {
    const matches = sheets.filter((candidate) => matchKey(candidate.name) === matchKey(sheet));
    const [only] = matches;
    if (matches.length === 1 && only !== undefined) {
      resolved.set(sheet, only);
      continue;
    }
    sink.add({
      severity: 'error',
      code: matches.length === 0 ? 'SHEET_MISSING' : 'SHEET_DUPLICATE',
      sheet,
      row: null,
      field: null,
      params: { sheet },
    });
  }
  return resolved;
}
