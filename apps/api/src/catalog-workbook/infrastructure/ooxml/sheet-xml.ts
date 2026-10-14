/** A plain string is a text cell; a raw cell carries its own type and inner XML (number, formula, error...). */
export type CellValue = string | { readonly t?: string; readonly xml: string };

export interface SheetDefinition {
  readonly name: string;
  /** Row 0 is the header. An undefined row is skipped, which leaves a gap in the row numbers. */
  readonly rows: readonly (readonly CellValue[] | undefined)[];
  readonly hidden?: boolean;
  /** Zero-based rows and columns flagged hidden. */
  readonly hiddenRows?: readonly number[];
  readonly hiddenColumns?: readonly number[];
  /** Zero-based columns whose typed values must stay text (number format `@`). */
  readonly textColumns?: readonly number[];
  readonly widths?: readonly number[];
  /** Zero-based column that offers a TRUE/FALSE dropdown. */
  readonly trueFalseColumn?: number;
}

export const escapeXml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function columnLetter(index: number): string {
  let letters = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

/** The text style (index 1 in styles.xml) is applied to the column and to its cells. */
export function sheetXml(sheet: SheetDefinition, aids: boolean): string {
  const text = new Set(sheet.textColumns ?? []);
  const hiddenColumns = new Set(sheet.hiddenColumns);
  const hiddenRows = new Set(sheet.hiddenRows);
  const columnCount = Math.max(0, ...sheet.rows.map((row) => row?.length ?? 0));
  const columns = Array.from({ length: columnCount }, (_, index) => {
    const width = aids ? sheet.widths?.[index] : undefined;
    const hidden = hiddenColumns.has(index) ? ' hidden="1"' : '';
    if (width === undefined && !text.has(index) && !hidden) return '';
    const attributes = width === undefined ? 'width="9"' : `width="${width}" customWidth="1"`;
    const style = text.has(index) ? ' style="1"' : '';
    return `<col min="${index + 1}" max="${index + 1}" ${attributes}${hidden}${style}/>`;
  }).join('');
  const rows = sheet.rows
    .map((row, rowIndex) => {
      if (row === undefined) return '';
      const cells = row
        .map((value, index) => {
          if (typeof value !== 'string') {
            const type = value.t === undefined ? '' : ` t="${value.t}"`;
            return `<c r="${columnLetter(index)}${rowIndex + 1}"${type}>${value.xml}</c>`;
          }
          const style = text.has(index) && rowIndex > 0 ? ' s="1"' : '';
          return `<c r="${columnLetter(index)}${rowIndex + 1}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
        })
        .join('');
      const hidden = hiddenRows.has(rowIndex) ? ' hidden="1"' : '';
      return `<row r="${rowIndex + 1}"${hidden}>${cells}</row>`;
    })
    .join('');
  const pane = '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>';
  const view = aids
    ? `<sheetViews><sheetView workbookViewId="0">${pane}</sheetView></sheetViews>`
    : '';
  const listColumn = aids ? sheet.trueFalseColumn : undefined;
  const letter = listColumn === undefined ? '' : columnLetter(listColumn);
  const validation =
    listColumn === undefined
      ? ''
      : `<dataValidations count="1"><dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${letter}2:${letter}1048576"><formula1>"TRUE,FALSE"</formula1></dataValidation></dataValidations>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${view}${columns && `<cols>${columns}</cols>`}<sheetData>${rows}</sheetData>${validation}</worksheet>`;
}
