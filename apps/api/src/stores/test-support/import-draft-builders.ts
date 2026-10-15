import type { ValidationReport } from '@importer/contracts';
import type {
  ImportableCatalog,
  ImportableImage,
  ImportableProduct,
  ImportableVariant,
} from '../domain/importable-catalog.js';
import { Money } from '../../shared-kernel/money/money.js';

export const draftVariant = (
  sku: string,
  overrides: Partial<ImportableVariant> = {},
  optionValues: readonly string[] = [],
): ImportableVariant => ({
  sku,
  price: Money.parse('10.5'),
  compareAtPrice: undefined,
  barcode: undefined,
  optionValues,
  inventory: { tracked: false, quantity: undefined, location: undefined },
  ...overrides,
});

export const draftImage = (
  position: number,
  path = `https://cdn.example.com/${position}.jpg`,
  kind: ImportableImage['kind'] = 'url',
): ImportableImage => ({
  path,
  kind,
  alt: undefined,
});

/** A simple product (no options, one variant) unless `overrides` say otherwise. */
export const draftProduct = (
  key: string,
  overrides: Partial<ImportableProduct> = {},
): ImportableProduct => ({
  productKey: key,
  handle: `handle-${key}`,
  title: `Title ${key}`,
  descriptionHtml: undefined,
  vendor: undefined,
  productType: undefined,
  tags: [],
  options: [],
  variants: [draftVariant(`SKU-${key}`)],
  images: [],
  ...overrides,
});

export const draftOf = (...products: ImportableProduct[]): ImportableCatalog => ({ products });

export const validReport: ValidationReport = {
  valid: true,
  fileSha256: 'a'.repeat(64),
  summary: { errorCount: 0, warningCount: 0 },
  truncated: false,
  issues: [],
};
