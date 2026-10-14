/** A Variantes row after field parsing (identity part). A field is `undefined` when empty or invalid. */
export interface VariantRow {
  /** Original 1-based spreadsheet row. */
  readonly sourceRow: number;
  readonly productKey: string | undefined;
  readonly sku: string | undefined;
}
