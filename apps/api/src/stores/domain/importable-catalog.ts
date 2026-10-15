import type { Money } from '../../shared-kernel/money/money.js';

/**
 * What the import needs from a validated workbook, declared here so the stores module does not
 * depend on the workbook module's types. The workbook draft is structurally assignable to it.
 */
export interface ImportableCatalog {
  readonly products: readonly ImportableProduct[];
}

export interface ImportableProduct {
  readonly productKey: string;
  readonly handle: string;
  readonly title: string;
  readonly descriptionHtml: string | undefined;
  readonly vendor: string | undefined;
  readonly productType: string | undefined;
  readonly tags: readonly string[];
  readonly options: readonly { readonly name: string; readonly values: readonly string[] }[];
  readonly variants: readonly ImportableVariant[];
  /** Ordered by position; the first one is the cover. */
  readonly images: readonly ImportableImage[];
}

export interface ImportableVariant {
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

export interface ImportableImage {
  /** An http(s) URL, or a relative path of a local file (which cannot be uploaded). */
  readonly path: string;
  readonly kind: 'url' | 'local';
  readonly alt: string | undefined;
}
