import type { Money } from '../../shared-kernel/money/money.js';

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
  /** Set by the price rule; `undefined` when empty, untrusted or invalid. */
  readonly price?: Money | undefined;
  readonly compareAtPrice?: Money | undefined;
  /** Set by the barcode rule; `undefined` when empty, untrusted or invalid. */
  readonly barcode?: string | undefined;
  /** Set by the inventory rule: the flag, with an empty flag and empty stock read as false. */
  readonly manageInventory?: boolean | undefined;
  /** Absolute quantity; `undefined` when empty, untrusted or invalid. */
  readonly stock?: number | undefined;
  /** One location name, trimmed; `undefined` when empty or untrusted. */
  readonly location?: string | undefined;
}
