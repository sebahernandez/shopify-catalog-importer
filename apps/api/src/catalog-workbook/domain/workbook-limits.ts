/** Soft caps that protect the process; none of them is a product rule. */
export interface WorkbookLimits {
  readonly maxUploadBytes: number;
  readonly maxUncompressedBytes: number;
  readonly maxEntries: number;
  readonly maxRatio: number;
  readonly maxRows: number;
  readonly maxColumns: number;
  readonly maxCellChars: number;
  readonly maxReportedIssues: number;
}

export const DEFAULT_WORKBOOK_LIMITS: WorkbookLimits = Object.freeze({
  maxUploadBytes: 20 * 1024 * 1024,
  maxUncompressedBytes: 150 * 1024 * 1024,
  maxEntries: 200,
  maxRatio: 100,
  maxRows: 50_000,
  maxColumns: 64,
  maxCellChars: 32_767,
  maxReportedIssues: 1_000,
});

/** Merges overrides over the defaults. The result is frozen, like the defaults. */
export function withLimits(overrides: Partial<WorkbookLimits> = {}): WorkbookLimits {
  return Object.freeze({ ...DEFAULT_WORKBOOK_LIMITS, ...overrides });
}
