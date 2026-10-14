import * as XLSX from 'xlsx';
import type { CellValue, WorkbookCell, WorkbookSheet } from '../../domain/workbook-cell.js';
import type { VerifiedArchive } from '../../ports/archive-inspector.port.js';
import type { ReadResult, SheetLimits, WorkbookReader } from '../../ports/workbook-reader.port.js';

type Parse = (data: Uint8Array, options: XLSX.ParsingOptions) => XLSX.WorkBook;

const UNREADABLE: ReadResult = { ok: false, finding: { code: 'FILE_UNREADABLE', params: {} } };
const VISIBILITY = ['visible', 'hidden', 'veryHidden'] as const;

/**
 * Number policy: SheetJS drops the lexical text of a number (10.50 arrives as the double 10.5), so
 * `raw` is String(double), the shortest text that round-trips. JavaScript prints values of 1e21 or
 * more, and non-zero values below 1e-6, in exponent form (1e+21, 1e-7). The reader keeps that form
 * unchanged on purpose: the decimal and code field rules reject exponent form (design 10a, 11a).
 */
function mapValue(cell: XLSX.CellObject): CellValue {
  switch (cell.t) {
    case 's':
      return { kind: 'text', text: String(cell.v) };
    case 'n':
      return { kind: 'number', raw: String(cell.v) };
    case 'b':
      return { kind: 'boolean', value: cell.v === true };
    case 'e':
      return { kind: 'error', code: cell.w ?? String(cell.v) };
    case 'd':
      // A Date is an absolute instant: UTC output does not depend on the process time zone.
      return { kind: 'date', iso: (cell.v as Date).toISOString() };
    default:
      return { kind: 'blank' };
  }
}

/** The library is only asked for what the package can pay for; see `read`. */
const hasStylesPart = (archive: VerifiedArchive): boolean =>
  archive.entries.some((entry) => entry.name.toLowerCase() === 'xl/styles.xml');

/** Reads with SheetJS CE and maps to the domain cell model. It keeps no state between reads. */
export class SheetJsWorkbookReader implements WorkbookReader {
  constructor(private readonly parse: Parse = XLSX.read) {}

  read(bytes: Uint8Array, archive: VerifiedArchive, limits: SheetLimits): Promise<ReadResult> {
    try {
      // cellStyles carries the hidden row and column flags but parses about 10 times slower when the
      // package has no styles part (spike U3c). Such a package is not one of ours or Excel's, so the
      // flags are skipped for it: its hidden rows and columns are not reported, and nothing else changes.
      const book = this.parse(bytes, {
        type: 'buffer',
        cellFormula: true,
        cellDates: true,
        cellStyles: hasStylesPart(archive),
      });
      return Promise.resolve(this.map(book, limits));
    } catch {
      // The library message can quote file content or paths: nothing of it leaves this adapter.
      return Promise.resolve(UNREADABLE);
    }
  }

  private map(book: XLSX.WorkBook, limits: SheetLimits): ReadResult {
    const sheets: WorkbookSheet[] = [];
    for (const [index, name] of book.SheetNames.entries()) {
      const sheet = book.Sheets[name];
      // A shared-string cell without its table makes the library drop the whole sheet.
      if (sheet === undefined) return UNREADABLE;
      const mapped = this.mapSheet(book, sheet, name, index, limits);
      if (!('rows' in mapped)) return mapped;
      sheets.push(mapped);
    }
    return { ok: true, sheets };
  }

  private mapSheet(
    book: XLSX.WorkBook,
    sheet: XLSX.WorkSheet,
    name: string,
    index: number,
    limits: SheetLimits,
  ): WorkbookSheet | Extract<ReadResult, { ok: false }> {
    const range = sheet['!ref'] === undefined ? undefined : XLSX.utils.decode_range(sheet['!ref']);
    const rowCount = range === undefined ? 0 : Math.max(0, range.e.r);
    const colCount = range === undefined ? 0 : range.e.c + 1;
    if (rowCount > limits.maxRows) {
      return failure('SHEET_ROW_LIMIT_EXCEEDED', {
        sheet: name,
        limit: limits.maxRows,
        actual: rowCount,
      });
    }
    if (colCount > limits.maxColumns) {
      return failure('SHEET_COLUMN_LIMIT_EXCEEDED', {
        sheet: name,
        limit: limits.maxColumns,
        actual: colCount,
      });
    }
    const rows = new Map<number, WorkbookCell[]>();
    const found = Object.keys(sheet)
      .filter((key) => !key.startsWith('!'))
      .map((ref) => ({ ref, at: XLSX.utils.decode_cell(ref) }))
      .sort((a, b) => a.at.r - b.at.r || a.at.c - b.at.c);
    for (const { ref, at } of found) {
      const cell = sheet[ref] as XLSX.CellObject;
      const value = mapValue(cell);
      if (value.kind === 'text' && value.text.length > limits.maxCellChars) {
        return failure(
          'CELL_TEXT_TOO_LONG',
          { limit: limits.maxCellChars, actual: value.text.length },
          { sheet: name, row: at.r + 1, col: at.c + 1 },
        );
      }
      const row = rows.get(at.r + 1) ?? [];
      row.push({ row: at.r + 1, col: at.c + 1, ref, value, formula: cell.f !== undefined });
      rows.set(at.r + 1, row);
    }
    return {
      name,
      index,
      visibility: VISIBILITY[book.Workbook?.Sheets?.[index]?.Hidden ?? 0] ?? 'visible',
      hiddenRows: flagged(sheet['!rows']),
      hiddenCols: flagged(sheet['!cols']),
      rows,
    };
  }
}

/** 1-based positions of the entries flagged hidden; the library leaves holes in sparse arrays. */
const flagged = (entries: readonly ({ hidden?: boolean } | undefined)[] | undefined) =>
  new Set(
    (entries ?? []).flatMap((entry, position) => (entry?.hidden === true ? [position + 1] : [])),
  );

function failure(
  code: 'SHEET_ROW_LIMIT_EXCEEDED' | 'SHEET_COLUMN_LIMIT_EXCEEDED' | 'CELL_TEXT_TOO_LONG',
  params: Record<string, string | number>,
  cell?: { sheet: string; row: number; col: number },
): Extract<ReadResult, { ok: false }> {
  return cell === undefined
    ? { ok: false, finding: { code, params } }
    : { ok: false, finding: { code, params }, cell };
}
