/** A Variantes row after field parsing. A field is `undefined` when empty, untrusted or invalid. */
export interface VariantRow {
  /** Original 1-based spreadsheet row. */
  readonly sourceRow: number;
  readonly productKey: string | undefined;
  readonly sku: string | undefined;
  /** Option pairs, trimmed; set by the options rule only for a complete, trusted pair. */
  readonly opcion1_nombre?: string | undefined;
  readonly opcion1_valor?: string | undefined;
  readonly opcion2_nombre?: string | undefined;
  readonly opcion2_valor?: string | undefined;
  readonly opcion3_nombre?: string | undefined;
  readonly opcion3_valor?: string | undefined;
}
