import {
  packageParts,
  type CellValue,
  type SheetDefinition,
} from '../infrastructure/ooxml/package-writer.js';
import { escapeXml } from '../infrastructure/ooxml/sheet-xml.js';
import { writeZip, type ZipEntry } from '../infrastructure/ooxml/zip-writer.js';

// Test-only: builds workbooks in memory so no binary fixture is ever committed.

const defaultSheet: SheetDefinition = {
  name: 'Variantes',
  rows: [
    ['sku', 'precio'],
    ['0123', '10.50'],
  ],
  textColumns: [0],
};

export const workbookParts = (
  sheets: readonly SheetDefinition[] = [defaultSheet],
  extra: readonly ZipEntry[] = [],
): ZipEntry[] => [...packageParts(sheets), ...extra];

export const buildWorkbook = (
  sheets?: readonly SheetDefinition[],
  extra?: readonly ZipEntry[],
): Buffer => writeZip(workbookParts(sheets, extra));

export const numberCell = (value: number): CellValue => ({ xml: `<v>${value}</v>` });
export const formulaCell = (formula: string, cached: string): CellValue => ({
  xml: `<f>${escapeXml(formula)}</f><v>${cached}</v>`,
});
export const sharedFormula = (si: number, formula: string, ref: string): CellValue => ({
  xml: `<f t="shared" ref="${ref}" si="${si}">${escapeXml(formula)}</f><v>0</v>`,
});
export const arrayFormula = (ref: string, formula: string): CellValue => ({
  xml: `<f t="array" ref="${ref}">${escapeXml(formula)}</f><v>0</v>`,
});
export const textFormula = (formula: string, cached: string): CellValue => ({
  t: 'str',
  xml: `<f>${escapeXml(formula)}</f><v>${escapeXml(cached)}</v>`,
});
export const errorCell = (code = '#DIV/0!'): CellValue => ({ t: 'e', xml: `<v>${code}</v>` });
export const dateCell = (iso: string): CellValue => ({ t: 'd', xml: `<v>${iso}</v>` });
/** The second run is bold, so the cell is genuine rich text. */
export const richTextCell = (runs: readonly [string, string]): CellValue => ({
  t: 'inlineStr',
  xml: `<is><r><t>${runs[0]}</t></r><r><rPr><b/></rPr><t>${runs[1]}</t></r></is>`,
});
export const longCell = (length: number): CellValue => 'x'.repeat(length);

const extraPart = (name: string): ZipEntry => ({ name, data: Buffer.from('test-only part') });
export const macroPart = extraPart('xl/vbaProject.bin');
export const externalLinkPart = extraPart('xl/externalLinks/externalLink1.xml');
export const embeddingPart = extraPart('xl/embeddings/oleObject1.bin');
