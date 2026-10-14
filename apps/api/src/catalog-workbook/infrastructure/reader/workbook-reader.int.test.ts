import { describe, expect, it } from 'vitest';
import { withLimits } from '../../domain/workbook-limits.js';
import { workbookReaderContract } from '../../test-support/workbook-reader.contract.js';
import { buildWorkbook, workbookParts } from '../../test-support/workbook-fixture-builder.js';
import { writeZip } from '../ooxml/zip-writer.js';
import { ZipArchiveInspector } from '../zip/zip-archive-inspector.js';
import { SheetJsWorkbookReader } from './sheetjs-workbook-reader.js';

workbookReaderContract('SheetJS', () => new SheetJsWorkbookReader());

const limits = withLimits();
const verified = (zip: Buffer) => {
  const inspection = new ZipArchiveInspector().inspect(zip, limits);
  if (!inspection.ok) throw new Error('fixture must pass the preflight');
  return inspection.archive;
};

describe('SheetJsWorkbookReader error mapping', () => {
  it('turns a library exception into a generic failure with no message, stack or path', async () => {
    const secret = '/Users/someone/private/catalogo.xlsx';
    const reader = new SheetJsWorkbookReader(() => {
      throw new Error(`cannot open ${secret}`);
    });
    const zip = buildWorkbook();
    const result = await reader.read(zip, verified(zip), limits);
    expect(result).toEqual({ ok: false, finding: { code: 'FILE_UNREADABLE', params: {} } });
    expect(JSON.stringify(result)).not.toMatch(/cannot open|Users|stack|Error/);
  });

  it('fails when a shared-string cell has no table, which makes the library drop the sheet', async () => {
    const zip = buildWorkbook([{ name: 'A', rows: [['h'], [{ t: 's', xml: '<v>0</v>' }]] }]);
    expect(await new SheetJsWorkbookReader().read(zip, verified(zip), limits)).toEqual({
      ok: false,
      finding: { code: 'FILE_UNREADABLE', params: {} },
    });
  });

  it('still reads a package without a styles part, without hidden row and column flags', async () => {
    // A package without styles must also lose the relationship and the content type that name it.
    const parts = workbookParts([
      {
        name: 'A',
        rows: [
          ['h', 'i'],
          ['a', 'b'],
        ],
        hiddenRows: [1],
        hiddenColumns: [1],
      },
    ])
      .filter((part) => part.name !== 'xl/styles.xml')
      .map((part) => ({
        ...part,
        data: Buffer.from(
          part.data
            .toString('utf8')
            .replace(/<Relationship [^>]*styles\.xml"\/>/, '')
            .replace(/<Override PartName="\/xl\/styles\.xml"[^>]*\/>/, ''),
        ),
      }));
    const zip = writeZip(parts);
    const result = await new SheetJsWorkbookReader().read(zip, verified(zip), limits);
    expect(result.ok && result.sheets[0]?.rows.size).toBe(2);
    expect(result.ok && result.sheets[0]?.hiddenRows.size).toBe(0);
  });
});
