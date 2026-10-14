import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKBOOK_LIMITS, withLimits } from './workbook-limits.js';

describe('DEFAULT_WORKBOOK_LIMITS', () => {
  it('holds the documented caps', () => {
    expect(DEFAULT_WORKBOOK_LIMITS).toEqual({
      maxUploadBytes: 20 * 1024 * 1024,
      maxUncompressedBytes: 150 * 1024 * 1024,
      maxEntries: 200,
      maxRatio: 100,
      maxRows: 50_000,
      maxColumns: 64,
      maxCellChars: 32_767,
      maxReportedIssues: 1_000,
    });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(DEFAULT_WORKBOOK_LIMITS)).toBe(true);
  });
});

describe('withLimits', () => {
  it('merges overrides over the defaults into a frozen copy', () => {
    const limits = withLimits({ maxEntries: 10 });
    expect(limits.maxEntries).toBe(10);
    expect(limits.maxRows).toBe(50_000);
    expect(Object.isFrozen(limits)).toBe(true);
    expect(DEFAULT_WORKBOOK_LIMITS.maxEntries).toBe(200);
  });
});
