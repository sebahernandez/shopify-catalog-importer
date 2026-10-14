/** A Productos row after field parsing. A field is `undefined` when empty or invalid. */
export interface ProductRow {
  /** Original 1-based spreadsheet row. */
  readonly sourceRow: number;
  readonly productKey: string | undefined;
  readonly handle: string | undefined;
  readonly title: string | undefined;
  readonly tags: readonly string[] | undefined;
}
