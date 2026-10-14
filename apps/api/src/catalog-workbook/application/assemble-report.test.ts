import { ISSUE_CODES, ValidationReport, renderIssue } from '@importer/contracts';
import { describe, expect, it } from 'vitest';
import { type CollectedIssue, IssueCollector } from '../domain/issue-collector.js';
import { assembleReport, productKeyIndex } from './assemble-report.js';

const SHA = 'a'.repeat(64);

const issue = (overrides: Partial<CollectedIssue> = {}): CollectedIssue => ({
  severity: 'error',
  code: 'REQUIRED_FIELD_MISSING',
  sheet: 'Productos',
  row: 2,
  field: 'titulo',
  params: { field: 'titulo' },
  ...overrides,
});

const assemble = (issues: readonly CollectedIssue[], max = 1_000) => {
  const collector = new IssueCollector(max);
  issues.forEach((item) => collector.add(item));
  return assembleReport(collector.build(), SHA);
};

describe('assembleReport', () => {
  it('orders file-level first, then sheet, row and column', () => {
    const report = assemble([
      issue({ sheet: 'Variantes', row: 2, field: 'sku' }),
      issue({ sheet: 'Productos', row: 3, field: 'titulo' }),
      issue({ sheet: 'Productos', row: 3, field: 'handle' }),
      issue({ sheet: null, row: null, field: null, code: 'FILE_UNREADABLE', params: {} }),
    ]);
    expect(report.issues.map(({ sheet, row, field }) => [sheet, row, field])).toEqual([
      [null, null, null],
      ['Productos', 3, 'handle'],
      ['Productos', 3, 'titulo'],
      ['Variantes', 2, 'sku'],
    ]);
  });

  it('orders an Imagenes error after Productos warnings when nothing is cut', () => {
    const warning = (row: number) =>
      issue({ severity: 'warning', code: 'EXAMPLE_PRODUCT', row, field: null });
    const report = assemble([
      issue({ sheet: 'Imagenes', row: 2, field: 'archivo', code: 'IMAGE_PATH_INVALID' }),
      warning(3),
      warning(2),
    ]);
    expect(report.issues.map(({ severity, sheet, row }) => [severity, sheet, row])).toEqual([
      ['warning', 'Productos', 2],
      ['warning', 'Productos', 3],
      ['error', 'Imagenes', 2],
    ]);
    expect(report.truncated).toBe(false);
  });

  it('is valid with only warnings', () => {
    const report = assemble([issue({ severity: 'warning' })]);
    expect(report).toMatchObject({ valid: true, summary: { errorCount: 0, warningCount: 1 } });
  });

  it('counts one error and two warnings', () => {
    const report = assemble([
      issue(),
      issue({ severity: 'warning', row: 3 }),
      issue({ severity: 'warning', row: 4 }),
    ]);
    expect(report).toMatchObject({ valid: false, summary: { errorCount: 1, warningCount: 2 } });
  });

  it('keeps 1,000 of 1,500 issues, flags truncation and keeps exact totals', () => {
    const issues = Array.from({ length: 1_500 }, (_, index) => issue({ row: index + 2 }));
    const report = assemble(issues);
    expect(report.issues).toHaveLength(1_000);
    expect(report).toMatchObject({ truncated: true, summary: { errorCount: 1_500 } });
  });

  it('keeps every error when 600 warnings come before 600 errors', () => {
    const warnings = Array.from({ length: 600 }, (_, i) =>
      issue({ severity: 'warning', row: i + 2 }),
    );
    const errors = Array.from({ length: 600 }, (_, i) => issue({ row: i + 2 }));
    const report = assemble([...warnings, ...errors]);
    expect(report.issues.filter(({ severity }) => severity === 'error')).toHaveLength(600);
    expect(report).toMatchObject({
      truncated: true,
      summary: { errorCount: 600, warningCount: 600 },
    });
  });

  it('lists three defects in sheet then row order', () => {
    const report = assemble([
      issue({ sheet: 'Imagenes', row: 2 }),
      issue({ sheet: 'Productos', row: 9 }),
      issue({ sheet: 'Productos', row: 4 }),
    ]);
    expect(report.issues.map(({ sheet, row }) => `${sheet}:${row}`)).toEqual([
      'Productos:4',
      'Productos:9',
      'Imagenes:2',
    ]);
  });

  it('gives identical lists for identical input', () => {
    const input = [issue({ row: 5 }), issue({ row: 3, severity: 'warning' }), issue({ row: 4 })];
    expect(assemble(input)).toEqual(assemble([...input]));
  });

  it('renders message and suggestedAction from the catalog', () => {
    const [first] = assemble([issue()]).issues;
    expect(first).toMatchObject(renderIssue('REQUIRED_FIELD_MISSING', { field: 'titulo' }));
  });

  it('passes fileSha256 through and parses with the contracts schema', () => {
    const report = assemble([issue(), issue({ severity: 'warning', row: 3 })]);
    expect(report.fileSha256).toBe(SHA);
    expect(ValidationReport.safeParse(report).success).toBe(true);
  });

  it('never reports a tier B code or a Shopify claim', () => {
    const report = assemble([issue()]);
    const codes: readonly string[] = ISSUE_CODES.options;
    expect(report.issues.every(({ code }) => codes.includes(code))).toBe(true);
    expect(codes.some((code) => /SHOPIFY|HANDLE_EXISTS|LOCATION_UNKNOWN/.test(code))).toBe(false);
    expect(JSON.stringify(report)).not.toMatch(/shopify/i);
  });

  it('carries the product key of the row, and null for file-level and unknown rows', () => {
    const collector = new IssueCollector(100);
    collector.add(issue({ sheet: 'Variantes', row: 4, field: 'sku' }));
    collector.add(issue({ sheet: 'Variantes', row: 5, field: 'sku' }));
    collector.add(issue({ sheet: null, row: null, field: null, code: 'FILE_UNREADABLE' }));
    const keys = productKeyIndex([], [{ sourceRow: 4, productKey: 'p-1', sku: undefined }], []);
    const report = assembleReport(collector.build(), SHA, keys);
    expect(report.issues.map(({ sheet, row, productKey }) => [sheet, row, productKey])).toEqual([
      [null, null, null],
      ['Variantes', 4, 'p-1'],
      ['Variantes', 5, null],
    ]);
  });
});
