import { createHash } from 'node:crypto';
import { COLUMNS, DATA_SHEETS } from '@importer/contracts';
import { describe, expect, it } from 'vitest';
import { GenerateTemplateUseCase } from '../../application/generate-template.use-case.js';
import { ValidateWorkbookUseCase } from '../../application/validate-workbook.use-case.js';
import { DEFAULT_WORKBOOK_LIMITS, withLimits } from '../../domain/workbook-limits.js';
import { SheetJsWorkbookReader } from '../reader/sheetjs-workbook-reader.js';
import { ZipArchiveInspector } from '../zip/zip-archive-inspector.js';
import { OoxmlTemplateWriter } from './ooxml-template-writer.js';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const generate = (aids = true) => new GenerateTemplateUseCase(new OoxmlTemplateWriter({ aids }));
const inspector = new ZipArchiveInspector();
const reader = new SheetJsWorkbookReader();

const readBack = async (bytes: Uint8Array) => {
  const inspection = inspector.inspect(bytes, withLimits());
  if (!inspection.ok) throw new Error('the template must pass the preflight');
  const read = await reader.read(bytes, inspection.archive, withLimits());
  if (!read.ok) throw new Error('the template must be readable');
  return read.sheets;
};

const validate = (bytes: Uint8Array) =>
  new ValidateWorkbookUseCase(inspector, reader, DEFAULT_WORKBOOK_LIMITS).execute(
    bytes,
    sha256(bytes),
  );

describe('OoxmlTemplateWriter', () => {
  it('writes identical bytes on every run', () => {
    expect(sha256(generate().execute())).toBe(sha256(generate().execute()));
  });

  it('reads back with four sheets, the contract headers and text identifiers', async () => {
    const sheets = await readBack(generate().execute());
    expect(sheets.map(({ name }) => name)).toEqual([...DATA_SHEETS, 'Instrucciones']);
    for (const name of DATA_SHEETS) {
      const header = sheets.find((sheet) => sheet.name === name)?.rows.get(1) ?? [];
      expect(header.map(({ value }) => value)).toEqual(
        COLUMNS[name].map(({ key }) => ({ kind: 'text', text: key })),
      );
    }
    const rows = sheets.find((sheet) => sheet.name === 'Variantes')?.rows;
    const barcodes = [...(rows?.values() ?? [])].slice(1).map((row) => row[4]?.value);
    expect(barcodes[0]).toEqual({ kind: 'text', text: '0123456789012' });
    for (const row of [...(rows?.values() ?? [])].slice(1)) {
      for (const cell of [row[1], row[4]]) expect(cell?.value.kind).not.toBe('number');
    }
  });

  it('has no formulas, macros, links or embedded content and passes the preflight', () => {
    const bytes = generate().execute();
    const inspection = inspector.inspect(bytes, withLimits());
    expect(inspection.ok).toBe(true);
    if (inspection.ok) {
      expect(inspection.archive.formulaParts).toEqual([]);
      const names = inspection.archive.entries.map(({ name }) => name);
      expect(names.filter((name) => /vba|externalLink|embeddings|\/media\//i.test(name))).toEqual(
        [],
      );
    }
  });

  it('validates with zero errors and one EXAMPLE_PRODUCT warning per example', async () => {
    const { report } = await validate(generate().execute());
    expect(report.summary.errorCount).toBe(0);
    expect(report.valid).toBe(true);
    expect(report.issues.map(({ code }) => code)).toEqual(['EXAMPLE_PRODUCT', 'EXAMPLE_PRODUCT']);
  });

  it('generates with the aids switched off and validation is unchanged', async () => {
    const withAids = await validate(generate(true).execute());
    const without = generate(false).execute();
    const { report } = await validate(without);
    expect(without).not.toEqual(generate(true).execute());
    expect(report.issues.map(({ code }) => code)).toEqual(
      withAids.report.issues.map(({ code }) => code),
    );
    expect(report.summary.errorCount).toBe(0);
  });
});
