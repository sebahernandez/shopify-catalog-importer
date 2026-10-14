import { escapeXml, sheetXml, type SheetDefinition } from './sheet-xml.js';
import { writeZip, type ZipEntry } from './zip-writer.js';

export type { CellValue, SheetDefinition } from './sheet-xml.js';

export interface PackageOptions {
  /** Frozen header, column widths and the TRUE/FALSE dropdown. The text format is not an aid. */
  readonly aids?: boolean;
}

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PACKAGE_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

const part = (name: string, body: string): ZipEntry => ({
  name,
  data: Buffer.from(XML + body, 'utf8'),
});

/** The parts of a minimal workbook, in a fixed order with fixed document timestamps. */
export function packageParts(
  sheets: readonly SheetDefinition[],
  options: PackageOptions = {},
): ZipEntry[] {
  const aids = options.aids ?? true;
  const numbered = sheets.map((sheet, index) => ({ sheet, id: index + 1 }));
  const override = (path: string, type: string) =>
    `<Override PartName="${path}" ContentType="application/vnd.openxmlformats-${type}+xml"/>`;
  const sheetOverrides = numbered
    .map(({ id }) =>
      override(`/xl/worksheets/sheet${id}.xml`, 'officedocument.spreadsheetml.worksheet'),
    )
    .join('');
  const relationship = (id: string, type: string, target: string) =>
    `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`;
  return [
    part(
      '[Content_Types].xml',
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${override('/xl/workbook.xml', 'officedocument.spreadsheetml.sheet.main')}${override('/xl/styles.xml', 'officedocument.spreadsheetml.styles')}${override('/docProps/core.xml', 'package.core-properties')}${sheetOverrides}</Types>`,
    ),
    part(
      '_rels/.rels',
      `<Relationships xmlns="${PACKAGE_REL}">${relationship('rId1', 'officeDocument', 'xl/workbook.xml')}<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`,
    ),
    part(
      'docProps/core.xml',
      '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dcterms:created xsi:type="dcterms:W3CDTF">2000-01-01T00:00:00Z</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">2000-01-01T00:00:00Z</dcterms:modified></cp:coreProperties>',
    ),
    part(
      'xl/workbook.xml',
      `<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets>${numbered.map(({ sheet, id }) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${id}"${sheet.hidden ? ' state="hidden"' : ''} r:id="rId${id}"/>`).join('')}</sheets></workbook>`,
    ),
    part(
      'xl/_rels/workbook.xml.rels',
      `<Relationships xmlns="${PACKAGE_REL}">${numbered.map(({ id }) => relationship(`rId${id}`, 'worksheet', `worksheets/sheet${id}.xml`)).join('')}${relationship(`rId${numbered.length + 1}`, 'styles', 'styles.xml')}</Relationships>`,
    ),
    part(
      'xl/styles.xml',
      `<styleSheet xmlns="${MAIN}"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf numFmtId="49" applyNumberFormat="1"/></cellXfs></styleSheet>`,
    ),
    ...numbered.map(({ sheet, id }) =>
      part(`xl/worksheets/sheet${id}.xml`, sheetXml(sheet, aids).slice(XML.length)),
    ),
  ];
}

export function writePackage(sheets: readonly SheetDefinition[], options?: PackageOptions): Buffer {
  return writeZip(packageParts(sheets, options));
}
