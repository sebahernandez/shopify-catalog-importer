import { describe, expect, it } from 'vitest';
import { packageParts, writePackage, type SheetDefinition } from './package-writer.js';

const variants: SheetDefinition = {
  name: 'Variantes',
  rows: [
    ['sku', 'codigo_barras', 'gestionar_inventario'],
    ['0123', 'A&B <1>', 'TRUE'],
  ],
  textColumns: [0, 1],
  widths: [18, 24, 22],
  trueFalseColumn: 2,
};
const part = (name: string, aids?: boolean) =>
  packageParts([variants, { name: 'Imagenes', rows: [] }], aids === undefined ? {} : { aids })
    .find((entry) => entry.name === name)
    ?.data.toString('utf8') ?? '';

describe('packageParts', () => {
  it('declares every part and links the workbook to its sheets', () => {
    const names = packageParts([variants]).map((entry) => entry.name);
    expect(names).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'docProps/core.xml',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]);
    expect(part('[Content_Types].xml')).toContain('/xl/worksheets/sheet2.xml');
    expect(part('xl/workbook.xml')).toContain('<sheet name="Imagenes" sheetId="2" r:id="rId2"/>');
    expect(part('xl/_rels/workbook.xml.rels')).toContain('Target="worksheets/sheet2.xml"');
  });

  it('stores text cells as strings, escaped, and keeps the leading zero', () => {
    const sheet = part('xl/worksheets/sheet1.xml');
    expect(sheet).toContain('<c r="A2" s="1" t="inlineStr"><is><t xml:space="preserve">0123</t>');
    expect(sheet).toContain('A&amp;B &lt;1&gt;');
    expect(sheet).not.toMatch(/<c r="A2"[^>]*><v>/);
  });

  it('formats the chosen columns as text', () => {
    expect(part('xl/styles.xml')).toContain('numFmtId="49"');
    expect(part('xl/worksheets/sheet1.xml')).toContain('<col min="1" max="1" width="18"');
    expect(part('xl/worksheets/sheet1.xml')).toMatch(/<col min="2" max="2" [^>]*style="1"/);
  });

  it('adds the usability aids: frozen header, widths and a TRUE/FALSE list', () => {
    const sheet = part('xl/worksheets/sheet1.xml');
    expect(sheet).toContain(
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    );
    expect(sheet).toContain('<col min="3" max="3" width="22"');
    expect(sheet).toContain('sqref="C2:C1048576"');
    expect(sheet).toContain('<formula1>"TRUE,FALSE"</formula1>');
  });

  it('switches the aids off without touching the data or the text format', () => {
    const sheet = part('xl/worksheets/sheet1.xml', false);
    expect(sheet).not.toMatch(/pane|dataValidation|customWidth/);
    expect(sheet).toContain('0123');
    expect(sheet).toMatch(/<col min="1" max="1" [^>]*style="1"/);
  });

  it('uses fixed document timestamps and identical bytes for identical input', () => {
    expect(part('docProps/core.xml')).toContain('2000-01-01T00:00:00Z');
    expect(writePackage([variants]).equals(writePackage([variants]))).toBe(true);
  });
});
