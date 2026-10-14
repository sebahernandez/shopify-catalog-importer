import { ValidationReport } from '@importer/contracts';
import { describe, expect, it, vi } from 'vitest';
import { buildSheet } from '../test-support/sheet-builder.js';
import type { WorkbookSheet } from '../domain/workbook-cell.js';
import { DEFAULT_WORKBOOK_LIMITS } from '../domain/workbook-limits.js';
import type { ArchiveInspector, Inspection } from '../ports/archive-inspector.port.js';
import type { ReadResult, WorkbookReader } from '../ports/workbook-reader.port.js';
import { ValidateWorkbookUseCase } from './validate-workbook.use-case.js';

const fsDouble = vi.hoisted(() => ({ writeFileSync: vi.fn(), readFileSync: vi.fn() }));
vi.mock('node:fs', () => fsDouble);

const SHA = 'b'.repeat(64);
const BYTES = new Uint8Array([1, 2, 3]);
const PASSED: Inspection = { ok: true, archive: { entries: [], formulaParts: [] } };

const PRODUCTOS = ['product_key', 'handle', 'titulo'];
const VARIANTES = ['product_key', 'sku', 'precio'];
const IMAGENES = ['product_key', 'archivo', 'orden'];

const workbook = (variants: (string | number)[][]): WorkbookSheet[] => [
  buildSheet('Productos', [PRODUCTOS, ['p-1', 'remera', 'Remera']]),
  buildSheet('Variantes', [VARIANTES, ...variants]),
  buildSheet('Imagenes', [IMAGENES, ['p-1', 'a.jpg', 1]]),
];

function setup(inspection: Inspection, read: () => Promise<ReadResult>) {
  const inspect = vi.fn<ArchiveInspector['inspect']>(() => inspection);
  const reader = vi.fn<WorkbookReader['read']>(read);
  const useCase = new ValidateWorkbookUseCase(
    { inspect },
    { read: reader },
    DEFAULT_WORKBOOK_LIMITS,
  );
  return { inspect, reader, useCase };
}

const reading = (sheets: WorkbookSheet[]) => () =>
  Promise.resolve<ReadResult>({ ok: true, sheets });

describe('ValidateWorkbookUseCase', () => {
  it('stops at a rejected archive: reader not called, one file-level issue, hash kept', async () => {
    const rejected: Inspection = { ok: false, findings: [{ code: 'FILE_NOT_XLSX', params: {} }] };
    const { reader, useCase } = setup(rejected, reading([]));
    const { report, draft } = await useCase.execute(BYTES, SHA);
    expect(reader).not.toHaveBeenCalled();
    expect(draft).toBeUndefined();
    expect(report.valid).toBe(false);
    expect(report.fileSha256).toBe(SHA);
    expect(report.issues.map(({ code, sheet, row }) => [code, sheet, row])).toEqual([
      ['FILE_NOT_XLSX', null, null],
    ]);
    expect(ValidationReport.safeParse(report).success).toBe(true);
  });

  it('turns a reader throw into FILE_UNREADABLE with nothing from the error', async () => {
    const boom = () => Promise.reject(new Error('/srv/secret/file.xlsx boom\n    at stack'));
    const { useCase } = setup(PASSED, boom);
    const { report } = await useCase.execute(BYTES, SHA);
    expect(report.issues.map(({ code, sheet }) => [code, sheet])).toEqual([
      ['FILE_UNREADABLE', null],
    ]);
    expect(JSON.stringify(report)).not.toMatch(/secret|boom|stack|\/srv/);
    expect(ValidationReport.safeParse(report).success).toBe(true);
  });

  it('reports a reader cap failure and stops', async () => {
    const capped = () =>
      Promise.resolve<ReadResult>({
        ok: false,
        finding: { code: 'SHEET_ROW_LIMIT_EXCEEDED', params: { sheet: 'Variantes', max: 50000 } },
      });
    const { report } = await setup(PASSED, capped).useCase.execute(BYTES, SHA);
    expect(report.issues.map(({ code, sheet }) => [code, sheet])).toEqual([
      ['SHEET_ROW_LIMIT_EXCEEDED', 'Variantes'],
    ]);
  });

  it('adds a file-level FORMULA_NOT_ALLOWED when the scan saw formulas the reader did not flag', async () => {
    const scanned: Inspection = { ok: true, archive: { entries: [], formulaParts: ['xl/w.xml'] } };
    const { report } = await setup(scanned, reading(workbook([['p-1', 'S1', 10]]))).useCase.execute(
      BYTES,
      SHA,
    );
    expect(report.issues.map(({ code, sheet }) => [code, sheet])).toContainEqual([
      'FORMULA_NOT_ALLOWED',
      null,
    ]);
    expect(report.valid).toBe(false);
  });

  it('reports only SHEET_MISSING when Variantes is absent, with no variant_sku cascade', async () => {
    const sheets = [
      buildSheet('Productos', [PRODUCTOS, ['p-1', 'remera', 'Remera']]),
      buildSheet('Imagenes', [
        [...IMAGENES, 'variant_sku'],
        ['p-1', 'a.jpg', 1, 'S1'],
      ]),
    ];
    const { report } = await setup(PASSED, reading(sheets)).useCase.execute(BYTES, SHA);
    expect(report.issues.map(({ code, sheet }) => [code, sheet])).toEqual([
      ['SHEET_MISSING', 'Variantes'],
    ]);
  });

  it('blocks a formula that sits only in Instrucciones or an unknown sheet', async () => {
    const formula = { value: { kind: 'blank' as const }, formula: true };
    for (const name of ['Instrucciones', 'Notas']) {
      const sheets = [...workbook([['p-1', 'S1', 10]]), buildSheet(name, [[formula]])];
      const found = { ok: true, archive: { entries: [], formulaParts: ['xl/w.xml'] } } as const;
      const { report, draft } = await setup(found, reading(sheets)).useCase.execute(BYTES, SHA);
      expect(draft).toBeUndefined();
      expect(report.valid).toBe(false);
      expect(report.issues).toMatchObject([
        { code: 'FORMULA_NOT_ALLOWED', params: { sheet: name, ref: 'A1' } },
      ]);
    }
  });

  it('gives zero errors and a draft for a valid workbook, without network or file access', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { inspect, reader, useCase } = setup(PASSED, reading(workbook([['p-1', 'S1', 10]])));
    const { report, draft } = await useCase.execute(BYTES, SHA);
    expect(report).toMatchObject({ valid: true, fileSha256: SHA, summary: { errorCount: 0 } });
    expect(draft?.products.map(({ productKey }) => productKey)).toEqual(['p-1']);
    expect(inspect).toHaveBeenCalledTimes(1);
    expect(reader).toHaveBeenCalledTimes(1);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(fsDouble.writeFileSync).not.toHaveBeenCalled();
    expect(fsDouble.readFileSync).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('reports row defects with their product key and builds no draft', async () => {
    const sheets = workbook([
      ['p-1', 'S1', 10],
      ['p-1', 'S1', 'abc'],
    ]);
    const { report, draft } = await setup(PASSED, reading(sheets)).useCase.execute(BYTES, SHA);
    expect(draft).toBeUndefined();
    const rows = report.issues.filter(({ sheet }) => sheet === 'Variantes');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(({ productKey }) => productKey === 'p-1')).toBe(true);
    expect(rows.some(({ row }) => row === 3)).toBe(true);
    expect(ValidationReport.safeParse(report).success).toBe(true);
  });

  it('carries nothing from one run into the next', async () => {
    let current = workbook([['p-1', 'S1', 'abc']]);
    const { useCase } = setup(PASSED, () => reading(current)());
    const first = await useCase.execute(BYTES, SHA);
    current = workbook([['p-1', 'S1', 10]]);
    const second = await useCase.execute(BYTES, 'c'.repeat(64));
    expect(first.report.valid).toBe(false);
    expect(second.report).toMatchObject({ valid: true, fileSha256: 'c'.repeat(64) });
    expect(second.report.issues).toEqual([]);
  });
});
