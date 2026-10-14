import { describe, expect, it, vi } from 'vitest';
import { writeZip, type ZipEntry } from '../ooxml/zip-writer.js';
import { withLimits } from '../../domain/workbook-limits.js';
import type { Inspection } from '../../ports/archive-inspector.port.js';
import { lyingSizes } from '../../test-support/crafted-zip.js';
import {
  arrayFormula,
  buildWorkbook,
  embeddingPart,
  externalLinkPart,
  formulaCell,
  macroPart,
  sharedFormula,
  textFormula,
  workbookParts,
} from '../../test-support/workbook-fixture-builder.js';
import { ZipArchiveInspector } from './zip-archive-inspector.js';

const inspect = (zip: Buffer): Inspection => new ZipArchiveInspector().inspect(zip, withLimits());
const codes = (zip: Buffer): string[] => {
  const result = inspect(zip);
  return result.ok ? [] : result.findings.map((finding) => finding.code);
};
const entry = (name: string, xml: string): ZipEntry => ({ name, data: Buffer.from(xml) });
/** Replaces one part of the default workbook; the result is a ZIP again. */
const replacing = (name: string, xml: string, extra: readonly ZipEntry[] = []): Buffer =>
  writeZip([...workbookParts().filter((part) => part.name !== name), entry(name, xml), ...extra]);
const withoutPart = (name: string): Buffer =>
  writeZip(workbookParts().filter((part) => part.name !== name));
const withContentType = (extra: string): Buffer =>
  replacing(
    '[Content_Types].xml',
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${extra}</Types>`,
  );
const formulaParts = (zip: Buffer): readonly string[] => {
  const result = inspect(zip);
  return result.ok ? result.archive.formulaParts : [];
};

describe('ZIP preflight, content (step 7)', () => {
  it('accepts a clean package and lists no formula part', () => {
    const result = inspect(buildWorkbook());
    expect(result.ok && result.archive.formulaParts).toEqual([]);
  });

  it('rejects a package without content types or workbook part as not an XLSX', () => {
    expect(codes(withoutPart('[Content_Types].xml'))).toEqual(['FILE_NOT_XLSX']);
    expect(codes(withoutPart('xl/workbook.xml'))).toEqual(['FILE_NOT_XLSX']);
  });

  it('rejects macros by part name, content type and macrosheet', () => {
    expect(codes(buildWorkbook(undefined, [macroPart]))).toEqual(['MACROS_NOT_ALLOWED']);
    expect(
      codes(
        withContentType(
          '<Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/>',
        ),
      ),
    ).toEqual(['MACROS_NOT_ALLOWED']);
    expect(
      codes(
        withContentType(
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/>',
        ),
      ),
    ).toEqual(['MACROS_NOT_ALLOWED']);
    expect(
      codes(buildWorkbook(undefined, [entry('xl/macrosheets/sheet1.xml', '<macrosheet/>')])),
    ).toEqual(['MACROS_NOT_ALLOWED']);
  });

  it('still rejects macros in a file that someone renamed to catalogo.xlsx', () => {
    // Only the bytes count; the name is never an input of the inspector.
    const renamed = buildWorkbook(undefined, [macroPart]);
    expect(codes(renamed)).toEqual(['MACROS_NOT_ALLOWED']);
  });

  it('rejects external links by part and by relationship target mode', () => {
    expect(codes(buildWorkbook(undefined, [externalLinkPart]))).toEqual([
      'EXTERNAL_LINKS_NOT_ALLOWED',
    ]);
    const rels =
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="x" Target="file:///c:/book.xlsx" TargetMode="External"/></Relationships>';
    expect(codes(replacing('xl/_rels/workbook.xml.rels', rels))).toEqual([
      'EXTERNAL_LINKS_NOT_ALLOWED',
    ]);
  });

  it('rejects embedded objects and ActiveX controls', () => {
    expect(codes(buildWorkbook(undefined, [embeddingPart]))).toEqual([
      'EMBEDDED_CONTENT_NOT_ALLOWED',
    ]);
    expect(codes(buildWorkbook(undefined, [entry('xl/activeX/activeX1.xml', '<ax/>')]))).toEqual([
      'EMBEDDED_CONTENT_NOT_ALLOWED',
    ]);
  });

  it('allows hyperlinks in sheet relationships', () => {
    const rels =
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="x" Target="https://example.com" TargetMode="External"/></Relationships>';
    const zip = buildWorkbook(undefined, [entry('xl/worksheets/_rels/sheet1.xml.rels', rels)]);
    expect(inspect(zip).ok).toBe(true);
  });

  it('returns several content findings together', () => {
    const zip = buildWorkbook(undefined, [macroPart, externalLinkPart, embeddingPart]);
    expect(codes(zip)).toEqual([
      'MACROS_NOT_ALLOWED',
      'EXTERNAL_LINKS_NOT_ALLOWED',
      'EMBEDDED_CONTENT_NOT_ALLOWED',
    ]);
  });

  it.each([
    ['plain', formulaCell('A1+1', '2')],
    ['shared', sharedFormula(0, 'A1+1', 'B2:B3')],
    ['array', arrayFormula('B2:B3', 'A1:A2*2')],
    ['text result', textFormula('"a"&"b"', 'ab')],
  ])('lists the worksheet that holds a %s formula', (_label, cell) => {
    const zip = buildWorkbook([
      { name: 'Clean', rows: [['a']] },
      { name: 'Formulas', rows: [['x', cell]] },
    ]);
    expect(formulaParts(zip)).toEqual(['xl/worksheets/sheet2.xml']);
  });

  it('lists a dynamic array formula and tolerates a namespace prefix on the element', () => {
    const dynamic =
      '<x:sheetData xmlns:x="m"><x:f t="array" ref="A1:A3" cm="1">SEQUENCE(3)</x:f></x:sheetData>';
    expect(formulaParts(replacing('xl/worksheets/sheet1.xml', dynamic))).toEqual([
      'xl/worksheets/sheet1.xml',
    ]);
  });

  it('does not mistake other elements that start with f for a formula', () => {
    const xml = '<worksheet><sheetFormatPr/><fooBar/></worksheet>';
    expect(formulaParts(replacing('xl/worksheets/sheet1.xml', xml))).toEqual([]);
  });

  it('never reaches the content scan or a reader when the archive is rejected', () => {
    const reader = { read: vi.fn() };
    const result = inspect(lyingSizes());
    if (result.ok) reader.read(result.archive);
    expect(result.ok).toBe(false);
    expect(reader.read).not.toHaveBeenCalled();
  });
});
