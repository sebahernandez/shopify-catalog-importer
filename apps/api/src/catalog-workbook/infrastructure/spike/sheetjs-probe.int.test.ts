import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { withLimits } from '../../domain/workbook-limits.js';
import type { SheetDefinition } from '../ooxml/package-writer.js';
import { writeZip } from '../ooxml/zip-writer.js';
import {
  arrayFormula,
  buildWorkbook,
  dateCell,
  errorCell,
  formulaCell,
  numberCell,
  richTextCell,
  sharedFormula,
  textFormula,
  workbookParts,
} from '../../test-support/workbook-fixture-builder.js';
import { ZipArchiveInspector } from '../zip/zip-archive-inspector.js';

// U3c spike: SheetJS CE 0.20.3, checked against its RAW output only (no adapter). Test names carry
// the exit criterion (E1 to E8) so spike-findings.md can cite them.

const OPTIONS: XLSX.ParsingOptions = {
  type: 'buffer',
  cellFormula: true,
  cellDates: true,
  cellStyles: true,
};
const SHARED_STRINGS =
  '<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="2" uniqueCount="2"><si><t>0123</t></si><si><t xml:space="preserve">  </t></si></sst>';

/** Every probed fixture must first pass the preflight, as production bytes would. */
const parse = (rows: SheetDefinition['rows'], extra: Partial<SheetDefinition> = {}) => {
  const zip = buildWorkbook([{ name: 'A', rows, ...extra }]);
  expect(new ZipArchiveInspector().inspect(zip, withLimits()).ok).toBe(true);
  return XLSX.read(zip, OPTIONS);
};
const cellOf = (workbook: XLSX.WorkBook, address: string): XLSX.CellObject =>
  workbook.Sheets['A']![address] as XLSX.CellObject;
/** A workbook whose shared string table holds one entry, registered in the types and the rels. */
const withSharedStrings = (rows: SheetDefinition['rows'], extra: Partial<SheetDefinition>) => {
  const zip = writeZip([
    ...workbookParts([{ name: 'A', rows, ...extra }]).map((part) => {
      const text = part.data.toString('utf8');
      if (part.name === '[Content_Types].xml')
        return {
          ...part,
          data: Buffer.from(
            text.replace(
              '</Types>',
              '<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>',
            ),
          ),
        };
      if (part.name === 'xl/_rels/workbook.xml.rels')
        return {
          ...part,
          data: Buffer.from(
            text.replace(
              '</Relationships>',
              '<Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>',
            ),
          ),
        };
      return part;
    }),
    { name: 'xl/sharedStrings.xml', data: Buffer.from(SHARED_STRINGS) },
  ]);
  expect(new ZipArchiveInspector().inspect(zip, withLimits()).ok).toBe(true);
  return zip;
};
const header = ['h1', 'h2', 'h3'];

describe('SheetJS 0.20.3 probe', () => {
  it('E1: formula cells are flagged with their coordinates, plain and dependent shared included', () => {
    const book = parse([
      header,
      [
        formulaCell('1+1', '2'),
        sharedFormula(0, 'A1+1', 'B2:B3'),
        arrayFormula('C2', 'SUM(1,2)'),
        textFormula('"a"&"b"', 'ab'),
      ],
      ['plain', { xml: '<f t="shared" si="0"/><v>0</v>' }, 'x'],
    ]);
    expect(cellOf(book, 'A2').f).toBe('1+1');
    expect(cellOf(book, 'B2').f).toBe('A1+1');
    expect(cellOf(book, 'B3').f).toBe('A2+1');
    expect(cellOf(book, 'C2').f).toBe('SUM(1,2)');
    expect(cellOf(book, 'D2')).toMatchObject({ t: 's', f: '"a"&"b"', v: 'ab' });
    expect(cellOf(book, 'A3').f).toBeUndefined();
  });

  it('E2: leading-zero text survives unmodified in s, str and inlineStr', () => {
    // The shared string table is a separate part; the fixture builder only writes inline strings.
    const book = XLSX.read(
      withSharedStrings(
        [
          header,
          [
            '0123',
            { t: 'str', xml: '<v>0123</v>' },
            { t: 's', xml: '<v>0</v>' },
            { t: 's', xml: '<v>1</v>' },
          ],
        ],
        { textColumns: [0] },
      ),
      OPTIONS,
    );
    expect(cellOf(book, 'A2')).toMatchObject({ t: 's', v: '0123' });
    expect(cellOf(book, 'B2')).toMatchObject({ t: 's', v: '0123' });
    expect(cellOf(book, 'C2')).toMatchObject({ t: 's', v: '0123' });
    expect(cellOf(book, 'D2')).toMatchObject({ t: 's', v: '  ' });
  });

  it('E3: numeric cells are numbers whose shortest decimal text is recoverable', () => {
    const book = parse([header, [numberCell(0.1 + 0.2), numberCell(1.1), numberCell(1e21)]]);
    expect(cellOf(book, 'A2')).toMatchObject({ t: 'n', v: 0.1 + 0.2 });
    expect(String(cellOf(book, 'A2').v)).toBe('0.30000000000000004');
    expect(String(cellOf(book, 'B2').v)).toBe('1.1');
    // The lexical <v> is not exposed: "10.50" comes back as the double 10.5 (documented limitation).
    expect(cellOf(parse([header, [{ xml: '<v>10.50</v>' }]]), 'A2')).toMatchObject({
      t: 'n',
      v: 10.5,
    });
  });

  it('E4: booleans, errors, dates, rich text and whitespace-only cells stay distinguishable', () => {
    const book = parse([
      header,
      [{ t: 'b', xml: '<v>1</v>' }, errorCell('#N/A'), dateCell('2024-01-02T03:04:05Z')],
      [richTextCell(['ab ', ' cd']), '   ', ''],
    ]);
    expect(cellOf(book, 'A2')).toMatchObject({ t: 'b', v: true });
    expect(cellOf(book, 'B2')).toMatchObject({ t: 'e', w: '#N/A' });
    const date = cellOf(book, 'C2');
    expect(date.t).toBe('d');
    expect((date.v as Date).toISOString()).toBe('2024-01-02T03:04:05.000Z');
    expect(cellOf(book, 'A3')).toMatchObject({ t: 's', v: 'ab  cd' });
    expect(cellOf(book, 'B3')).toMatchObject({ t: 's', v: '   ' });
    expect(cellOf(book, 'C3')).toMatchObject({ t: 's', v: '' });
  });

  it('E5: hidden sheet, row and column flags are reported', () => {
    const book = XLSX.read(
      buildWorkbook([
        { name: 'A', rows: [header, ['a', 'b', 'c']], hiddenRows: [1], hiddenColumns: [1] },
        { name: 'B', rows: [header], hidden: true },
      ]),
      OPTIONS,
    );
    expect(book.Workbook?.Sheets?.map((sheet) => sheet.Hidden)).toEqual([0, 1]);
    const sheet = book.Sheets['A']!;
    expect(sheet['!rows']?.[1]?.hidden).toBe(true);
    expect(sheet['!rows']?.[0]?.hidden).toBeFalsy();
    expect(sheet['!cols']?.[1]?.hidden).toBe(true);
    expect(sheet['!cols']?.[0]?.hidden).toBeFalsy();
  });

  it('E6: original 1-based rows survive gaps', () => {
    const book = parse([header, undefined, undefined, ['late'], undefined, ['later']]);
    const sheet = book.Sheets['A']!;
    const rows = Object.keys(sheet)
      .filter((key) => !key.startsWith('!'))
      .map((key) => XLSX.utils.decode_cell(key).r + 1);
    expect(new Set(rows)).toEqual(new Set([1, 4, 6]));
    expect(sheet['!ref']).toBe('A1:C6');
    expect(sheet['A2']).toBeUndefined();
  });

  it('E7: ESM import works; no eval, network, file system or install scripts; Apache-2.0', () => {
    const entry = createRequire(import.meta.url).resolve('xlsx');
    const source = readFileSync(join(dirname(entry), 'xlsx.mjs'), 'utf8');
    expect(source).not.toMatch(/\beval\s*\(|new Function|^import\s|\bimport\s*\(/m);
    expect(source).not.toMatch(/XMLHttpRequest|\bfetch\s*\(|child_process|\bhttps?\.request/);
    // The file system is reachable only through an explicit set_fs call, never required.
    expect(source).not.toMatch(/^[^/\n]*\brequire\s*\(/m);
    const manifest = JSON.parse(readFileSync(join(dirname(entry), 'package.json'), 'utf8')) as {
      license: string;
      scripts: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(manifest.license).toBe('Apache-2.0');
    expect(Object.keys(manifest.scripts)).not.toEqual(
      expect.arrayContaining(['preinstall', 'install', 'postinstall']),
    );
    expect(manifest.dependencies).toEqual({});
  });

  it('E8: 5,000 rows by 20 columns parse within 2 seconds', () => {
    const rows = Array.from({ length: 5_000 }, (_, row) =>
      Array.from({ length: 20 }, (_, column) =>
        column % 2 === 0 ? `r${row}c${column}` : numberCell(row * column + 0.5),
      ),
    );
    const zip = buildWorkbook([{ name: 'A', rows }]);
    const started = performance.now();
    const book = XLSX.read(zip, OPTIONS);
    expect(performance.now() - started).toBeLessThan(2_000);
    expect(book.Sheets['A']!['!ref']).toBe('A1:T5000');
  });
});
