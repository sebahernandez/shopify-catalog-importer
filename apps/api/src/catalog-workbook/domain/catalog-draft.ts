import type { Money } from '../../shared-kernel/money/money.js';

/** Normalized catalog for the next slice. Every element keeps its original 1-based `sourceRow`. */
export interface CatalogDraft {
  readonly products: readonly DraftProduct[];
}

export interface DraftProduct {
  readonly sourceRow: number;
  readonly productKey: string;
  readonly handle: string;
  readonly title: string;
  /** Raw `descripcion_html` text, sent as-is; `undefined` when the cell is empty. */
  readonly descriptionHtml: string | undefined;
  /** `marca`. */
  readonly vendor: string | undefined;
  /** `tipo`. */
  readonly productType: string | undefined;
  readonly tags: readonly string[];
  readonly options: readonly DraftOption[];
  readonly variants: readonly DraftVariant[];
  /** Ordered by position; the first one is the cover. */
  readonly images: readonly DraftImage[];
}

/** An option name with its values in first-seen order; `sourceRow` is the first variant naming it. */
export interface DraftOption {
  readonly sourceRow: number;
  readonly name: string;
  readonly values: readonly string[];
}

export interface DraftVariant {
  readonly sourceRow: number;
  readonly sku: string;
  readonly price: Money;
  readonly compareAtPrice: Money | undefined;
  readonly barcode: string | undefined;
  /** One value per product option, in option order. */
  readonly optionValues: readonly string[];
  readonly inventory: {
    readonly tracked: boolean;
    readonly quantity: number | undefined;
    readonly location: string | undefined;
  };
}

export interface DraftImage {
  readonly sourceRow: number;
  /** An http(s) URL as written, or a relative path with `/` separators. */
  readonly path: string;
  readonly kind: 'url' | 'local';
  /** The row's `orden`. */
  readonly position: number;
  readonly cover: boolean;
  readonly alt: string | undefined;
  readonly variantSku: string | undefined;
}
