/** An Imagenes row after field parsing. A field is `undefined` when empty, untrusted or invalid. */
export interface ImageRow {
  /** Original 1-based spreadsheet row. */
  readonly sourceRow: number;
  readonly productKey: string | undefined;
  /** Normalized relative path, with `/` separators. */
  readonly path: string | undefined;
  /** Positive integer; the lowest order of a product is its cover. */
  readonly order: number | undefined;
  readonly alt: string | undefined;
  /** Trimmed `variant_sku` text, set only when it matched exactly one variant of the product. */
  readonly variantSku: string | undefined;
}
