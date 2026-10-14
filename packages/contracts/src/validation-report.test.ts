import { describe, expect, it } from 'vitest';
import { ValidationIssue, ValidationReport } from './validation-report.js';

const cellIssue = {
  severity: 'error',
  code: 'SHEET_MISSING',
  params: { sheet: 'Variantes', limit: 4, strict: true },
  sheet: 'Variantes',
  row: 4,
  field: 'precio',
  productKey: 'P-1',
  message: 'Falta la hoja.',
  suggestedAction: 'Agrega la hoja.',
};
const fileIssue = {
  ...cellIssue,
  code: 'FILE_NOT_XLSX',
  params: {},
  sheet: null,
  row: null,
  field: null,
  productKey: null,
};
const report = {
  valid: false,
  fileSha256: 'a'.repeat(64),
  summary: { errorCount: 1, warningCount: 0 },
  truncated: false,
  issues: [cellIssue],
};

describe('ValidationIssue', () => {
  it('accepts a cell-level issue', () => {
    expect(ValidationIssue.parse(cellIssue)).toEqual(cellIssue);
  });

  it('accepts a file-level issue with null sheet, row and field', () => {
    expect(ValidationIssue.parse(fileIssue)).toEqual(fileIssue);
  });

  it.each([
    ['unknown code', { ...cellIssue, code: 'NOPE' }],
    ['nested params', { ...cellIssue, params: { a: { b: 1 } } }],
    ['null param value', { ...cellIssue, params: { a: null } }],
    ['unknown severity', { ...cellIssue, severity: 'info' }],
    ['row zero', { ...cellIssue, row: 0 }],
    ['empty message', { ...cellIssue, message: '' }],
    ['empty suggested action', { ...cellIssue, suggestedAction: '' }],
  ])('rejects %s', (_label, value) => {
    expect(ValidationIssue.safeParse(value).success).toBe(false);
  });
});

describe('ValidationReport', () => {
  it('accepts a well-formed report', () => {
    expect(ValidationReport.parse(report)).toEqual(report);
  });

  it('accepts a valid report with warnings only', () => {
    const warnings = { ...report, valid: true, summary: { errorCount: 0, warningCount: 2 } };
    expect(ValidationReport.safeParse(warnings).success).toBe(true);
  });

  it.each([
    ['uppercase digest', { ...report, fileSha256: 'A'.repeat(64) }],
    ['short digest', { ...report, fileSha256: 'a'.repeat(63) }],
    ['non-hex digest', { ...report, fileSha256: 'g'.repeat(64) }],
    ['valid with errors', { ...report, valid: true }],
    ['invalid without errors', { ...report, summary: { errorCount: 0, warningCount: 0 } }],
    ['non-boolean truncated', { ...report, truncated: 'no' }],
    ['missing counts', { ...report, summary: { errorCount: 1 } }],
  ])('rejects %s', (_label, value) => {
    expect(ValidationReport.safeParse(value).success).toBe(false);
  });
});
