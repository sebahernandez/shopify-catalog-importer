import { COLUMNS, DATA_SHEETS, type DataSheet } from '@importer/contracts';

/** A finding before it is rendered into a report issue. `code` is a plain domain code. */
export interface CollectedIssue {
  readonly severity: 'error' | 'warning';
  readonly code: string;
  readonly sheet: DataSheet | null;
  readonly row: number | null;
  readonly field: string | null;
  readonly params: Readonly<Record<string, string | number | boolean>>;
}

export interface CollectedReport {
  readonly issues: readonly CollectedIssue[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly truncated: boolean;
}

function columnIndex(issue: CollectedIssue): number {
  if (issue.sheet === null || issue.field === null) {
    return -1;
  }
  const index = COLUMNS[issue.sheet].findIndex((column) => column.key === issue.field);
  return index === -1 ? COLUMNS[issue.sheet].length : index;
}

/** File-level issues first, then sheet order, row, column order and code. */
function compare(left: CollectedIssue, right: CollectedIssue): number {
  const sheetOf = (issue: CollectedIssue) =>
    issue.sheet === null ? -1 : DATA_SHEETS.indexOf(issue.sheet);
  return (
    sheetOf(left) - sheetOf(right) ||
    (left.row ?? -1) - (right.row ?? -1) ||
    columnIndex(left) - columnIndex(right) ||
    (left.code < right.code ? -1 : left.code > right.code ? 1 : 0)
  );
}

/** Counts every issue but keeps at most `maxReportedIssues` of each severity. */
export class IssueCollector {
  readonly #kept = { error: [] as CollectedIssue[], warning: [] as CollectedIssue[] };
  readonly #counts = { error: 0, warning: 0 };

  constructor(private readonly maxReportedIssues: number) {}

  add(issue: CollectedIssue): void {
    this.#counts[issue.severity] += 1;
    if (this.#kept[issue.severity].length < this.maxReportedIssues) {
      this.#kept[issue.severity].push(issue);
    }
  }

  /** Errors come before warnings, each sorted; the list is cut at the cap. */
  build(): CollectedReport {
    const { error, warning } = this.#kept;
    const issues = [...error.sort(compare), ...warning.sort(compare)].slice(
      0,
      this.maxReportedIssues,
    );
    const total = this.#counts.error + this.#counts.warning;
    return {
      issues,
      errorCount: this.#counts.error,
      warningCount: this.#counts.warning,
      truncated: total > issues.length,
    };
  }
}
