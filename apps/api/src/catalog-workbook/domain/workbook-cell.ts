/** What a reader reports for one cell. Text is never trimmed here. */
export type CellValue =
  | { kind: 'text'; text: string }
  | { kind: 'number'; raw: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'error'; code: string }
  | { kind: 'date'; iso: string }
  | { kind: 'blank' };

/** Row and column are 1-based. */
export interface WorkbookCell {
  readonly row: number;
  readonly col: number;
  readonly ref: string;
  readonly value: CellValue;
  readonly formula: boolean;
}

export interface WorkbookSheet {
  readonly name: string;
  readonly index: number;
  readonly visibility: 'visible' | 'hidden' | 'veryHidden';
  readonly hiddenRows: ReadonlySet<number>;
  readonly hiddenCols: ReadonlySet<number>;
  readonly rows: ReadonlyMap<number, readonly WorkbookCell[]>;
}

/** The cell as rules see it: text trimmed, empty and whitespace-only text collapsed to `empty`. */
export type FieldValue = Exclude<CellValue, { kind: 'blank' }> | { kind: 'empty' };

export function normalizeCell(value: CellValue | undefined): FieldValue {
  if (value === undefined || value.kind === 'blank') {
    return { kind: 'empty' };
  }
  if (value.kind === 'text') {
    const text = value.text.trim();
    return text === '' ? { kind: 'empty' } : { kind: 'text', text };
  }
  return value;
}
