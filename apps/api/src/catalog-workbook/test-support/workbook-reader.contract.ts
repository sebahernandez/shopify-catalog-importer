import { describe, expect, it } from 'vitest';
import type { WorkbookCell, WorkbookSheet } from '../domain/workbook-cell.js';
import { withLimits, type WorkbookLimits } from '../domain/workbook-limits.js';
import type { SheetDefinition } from '../infrastructure/ooxml/package-writer.js';
import { ZipArchiveInspector } from '../infrastructure/zip/zip-archive-inspector.js';
import type { ReadResult, WorkbookReader } from '../ports/workbook-reader.port.js';
import {
  arrayFormula,
  buildWorkbook,
  dateCell,
  errorCell,
  formulaCell,
  longCell,
  numberCell,
  richTextCell,
  sharedFormula,
  textFormula,
} from './workbook-fixture-builder.js';

/** Runs the reader through real bytes: every fixture first passes the real preflight. */
export async function readFixture(
  reader: WorkbookReader,
  sheets: readonly SheetDefinition[],
  overrides: Partial<WorkbookLimits> = {},
): Promise<ReadResult> {
  const limits = withLimits(overrides);
  const zip = buildWorkbook(sheets);
  const inspection = new ZipArchiveInspector().inspect(zip, limits);
  if (!inspection.ok) throw new Error('fixture must pass the preflight');
  return reader.read(zip, inspection.archive, limits);
}

const header = ['h1', 'h2', 'h3'];

/** The behaviour every WorkbookReader adapter must show. */
export function workbookReaderContract(name: string, makeReader: () => WorkbookReader): void {
  const sheetsOf = async (
    sheets: readonly SheetDefinition[],
    overrides: Partial<WorkbookLimits> = {},
  ): Promise<readonly WorkbookSheet[]> => {
    const result = await readFixture(makeReader(), sheets, overrides);
    if (!result.ok) throw new Error(`unexpected failure ${result.finding.code}`);
    return result.sheets;
  };
  const cells = async (
    rows: SheetDefinition['rows'],
    extra: Partial<SheetDefinition> = {},
  ): Promise<Map<string, WorkbookCell>> => {
    const [sheet] = await sheetsOf([{ name: 'A', rows, ...extra }]);
    const byRef = new Map<string, WorkbookCell>();
    for (const row of sheet!.rows.values()) for (const cell of row) byRef.set(cell.ref, cell);
    return byRef;
  };

  describe(`WorkbookReader contract: ${name}`, () => {
    it('keeps text and numbers apart, with leading zeros and whitespace untouched', async () => {
      const book = await cells(
        [header, ['0123', '  padded ', numberCell(42), numberCell(0.1 + 0.2), numberCell(1.1)]],
        { textColumns: [0] },
      );
      expect(book.get('A2')?.value).toEqual({ kind: 'text', text: '0123' });
      expect(book.get('B2')?.value).toEqual({ kind: 'text', text: '  padded ' });
      expect(book.get('C2')?.value).toEqual({ kind: 'number', raw: '42' });
      expect(book.get('D2')?.value).toEqual({ kind: 'number', raw: '0.30000000000000004' });
      expect(book.get('E2')?.value).toEqual({ kind: 'number', raw: '1.1' });
    });

    it('maps booleans, errors, dates and rich text', async () => {
      const book = await cells([
        header,
        [{ t: 'b', xml: '<v>1</v>' }, errorCell('#N/A'), dateCell('2024-01-02T03:04:05Z')],
        [richTextCell(['ab ', ' cd']), '   ', ''],
      ]);
      expect(book.get('A2')?.value).toEqual({ kind: 'boolean', value: true });
      expect(book.get('B2')?.value).toEqual({ kind: 'error', code: '#N/A' });
      expect(book.get('C2')?.value).toEqual({ kind: 'date', iso: '2024-01-02T03:04:05.000Z' });
      expect(book.get('A3')?.value).toEqual({ kind: 'text', text: 'ab  cd' });
      expect(book.get('B3')?.value).toEqual({ kind: 'text', text: '   ' });
      expect(book.get('C3')?.value).toEqual({ kind: 'text', text: '' });
    });

    it('reports sheet order, hidden sheets, hidden rows and hidden columns', async () => {
      const sheets = await sheetsOf([
        { name: 'A', rows: [header, ['a', 'b', 'c']], hiddenRows: [1], hiddenColumns: [1] },
        { name: 'B', rows: [header], hidden: true },
      ]);
      expect(sheets.map((sheet) => [sheet.name, sheet.index, sheet.visibility])).toEqual([
        ['A', 0, 'visible'],
        ['B', 1, 'hidden'],
      ]);
      expect([...sheets[0]!.hiddenRows]).toEqual([2]);
      expect([...sheets[0]!.hiddenCols]).toEqual([2]);
      expect(sheets[1]!.hiddenRows.size).toBe(0);
    });

    it('keeps the original 1-based row numbers across gaps', async () => {
      const [sheet] = await sheetsOf([
        { name: 'A', rows: [header, undefined, undefined, ['late', 'x'], undefined, ['later']] },
      ]);
      expect([...sheet!.rows.keys()]).toEqual([1, 4, 6]);
      expect(sheet!.rows.get(4)).toMatchObject([
        { row: 4, col: 1, ref: 'A4' },
        { row: 4, col: 2, ref: 'B4' },
      ]);
    });

    it('accepts a cell of exactly the cap and rejects one character more', async () => {
      const at = await readFixture(makeReader(), [
        { name: 'A', rows: [header, [longCell(32_767)]] },
      ]);
      expect(at.ok).toBe(true);
      const over = await readFixture(makeReader(), [
        { name: 'A', rows: [header, ['ok', longCell(32_768)]] },
      ]);
      expect(over).toEqual({
        ok: false,
        finding: { code: 'CELL_TEXT_TOO_LONG', params: { limit: 32_767, actual: 32_768 } },
        cell: { sheet: 'A', row: 2, col: 2 },
      });
    });

    it('fails the file when a sheet has too many data rows or columns', async () => {
      const rows = [header, ['1'], ['2'], ['3'], ['4'], ['5']];
      expect(await readFixture(makeReader(), [{ name: 'A', rows }], { maxRows: 3 })).toEqual({
        ok: false,
        finding: { code: 'SHEET_ROW_LIMIT_EXCEEDED', params: { sheet: 'A', limit: 3, actual: 5 } },
      });
      expect(await readFixture(makeReader(), [{ name: 'A', rows }], { maxRows: 5 })).toMatchObject({
        ok: true,
      });
      const wide = [['a', 'b', 'c', 'd']];
      expect(
        await readFixture(makeReader(), [{ name: 'W', rows: wide }], { maxColumns: 3 }),
      ).toEqual({
        ok: false,
        finding: {
          code: 'SHEET_COLUMN_LIMIT_EXCEEDED',
          params: { sheet: 'W', limit: 3, actual: 4 },
        },
      });
    });

    it('flags plain, shared, array and text-result formulas at their coordinates', async () => {
      const book = await cells([
        header,
        [
          formulaCell('1+1', '2'),
          sharedFormula(0, 'A1+1', 'B2:B3'),
          arrayFormula('C2', 'SUM(1,2)'),
          textFormula('"a"&"b"', 'ab'),
        ],
        ['plain', { xml: '<f t="shared" si="0"/><v>0</v>' }, 'x'],
      ]);
      const flagged = [...book.values()].filter((cell) => cell.formula).map((cell) => cell.ref);
      expect(flagged).toEqual(['A2', 'B2', 'C2', 'D2', 'B3']);
      expect(book.get('D2')?.value).toEqual({ kind: 'text', text: 'ab' });
      expect(book.get('A3')?.formula).toBe(false);
    });
  });
}
