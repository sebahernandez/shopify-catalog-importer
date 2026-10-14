import type { CellValue } from '../infrastructure/ooxml/package-writer.js';
import { describe, expect, it } from 'vitest';
import {
  arrayFormula,
  buildWorkbook,
  dateCell,
  embeddingPart,
  errorCell,
  externalLinkPart,
  formulaCell,
  longCell,
  macroPart,
  numberCell,
  richTextCell,
  sharedFormula,
  textFormula,
  workbookParts,
} from './workbook-fixture-builder.js';

const sheetXml = (cells: readonly CellValue[]) =>
  workbookParts([{ name: 'Variantes', rows: [['sku'], cells] }])
    .find((entry) => entry.name === 'xl/worksheets/sheet1.xml')
    ?.data.toString('utf8') ?? '';

describe('buildWorkbook', () => {
  it('builds a valid, deterministic workbook with a default sheet', () => {
    const bytes = buildWorkbook();
    expect(bytes.subarray(0, 4).toString('hex')).toBe('504b0304');
    expect(bytes.includes('xl/workbook.xml')).toBe(true);
    expect(buildWorkbook().equals(bytes)).toBe(true);
  });

  it.each([
    ['number', numberCell(12.5), '<c r="A2"><v>12.5</v></c>'],
    ['plain formula', formulaCell('1+1', '2'), '<f>1+1</f><v>2</v>'],
    [
      'shared formula',
      sharedFormula(0, 'B2*2', 'A2:A3'),
      '<f t="shared" ref="A2:A3" si="0">B2*2</f>',
    ],
    ['array formula', arrayFormula('A2:A3', 'B2:B3'), '<f t="array" ref="A2:A3">B2:B3</f>'],
    [
      'text-result formula',
      textFormula('"a"&"b"', 'ab'),
      't="str"><f>&quot;a&quot;&amp;&quot;b&quot;</f><v>ab</v>',
    ],
    ['error', errorCell(), 't="e"><v>#DIV/0!</v>'],
    ['date', dateCell('2024-01-31T00:00:00Z'), 't="d"><v>2024-01-31T00:00:00Z</v>'],
    [
      'rich text',
      richTextCell(['a', 'b']),
      '<is><r><t>a</t></r><r><rPr><b/></rPr><t>b</t></r></is>',
    ],
    ['long cell', longCell(40000), `>${'x'.repeat(40000)}<`],
  ])('writes a %s cell', (_name, cell, expected) => {
    expect(sheetXml([cell])).toContain(expected);
  });

  it('writes hidden sheet, hidden row, hidden column and sparse rows', () => {
    const [, , , workbook, , , sheet] = workbookParts([
      {
        name: 'H',
        rows: [['a', 'b'], undefined, ['c']],
        hidden: true,
        hiddenRows: [2],
        hiddenColumns: [1],
      },
    ]);
    expect(workbook?.data.toString('utf8')).toContain('state="hidden"');
    expect(sheet?.data.toString('utf8')).toMatch(/hidden="1"[^]*<row r="3" hidden="1">/);
  });

  it.each([
    ['macro part', macroPart, 'xl/vbaProject.bin'],
    ['external link', externalLinkPart, 'xl/externalLinks/externalLink1.xml'],
    ['embedding', embeddingPart, 'xl/embeddings/oleObject1.bin'],
  ])('adds a %s to the package', (_name, extra, name) => {
    expect(extra.name).toBe(name);
    expect(buildWorkbook(undefined, [extra]).includes(name)).toBe(true);
  });
});
