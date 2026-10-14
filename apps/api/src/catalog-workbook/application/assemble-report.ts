import { ISSUE_CODES, type ValidationReport, renderIssue } from '@importer/contracts';
import type { CollectedReport } from '../domain/issue-collector.js';

/**
 * Turns the collector output into the contracts report. The collector already counted every issue,
 * sorted (file, sheet, row, column, code), kept errors before warnings and cut at the cap, so this
 * step only renders each issue and carries the totals. `fileSha256` arrives computed.
 */
export function assembleReport(collected: CollectedReport, fileSha256: string): ValidationReport {
  return {
    valid: collected.errorCount === 0,
    fileSha256,
    summary: { errorCount: collected.errorCount, warningCount: collected.warningCount },
    truncated: collected.truncated,
    issues: collected.issues.map((issue) => {
      const code = ISSUE_CODES.parse(issue.code);
      return {
        severity: issue.severity,
        code,
        params: { ...issue.params },
        sheet: issue.sheet,
        row: issue.row,
        field: issue.field,
        productKey: null,
        ...renderIssue(code, issue.params),
      };
    }),
  };
}
