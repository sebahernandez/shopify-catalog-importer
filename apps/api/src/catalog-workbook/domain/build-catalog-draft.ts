import type {
  CatalogDraft,
  DraftImage,
  DraftOption,
  DraftProduct,
  DraftVariant,
} from './catalog-draft.js';
import type { ImageRow } from './image-row.js';
import type { ProductRow } from './product-row.js';
import type { VariantRow } from './variant-row.js';

/** With zero errors the required fields are present; anything else is a caller bug. */
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Rows are inconsistent with a report without errors.');
  return value;
}

function optionNames(variant: VariantRow): readonly (string | undefined)[] {
  return [variant.opcion1_nombre, variant.opcion2_nombre, variant.opcion3_nombre];
}

function optionValues(variant: VariantRow): readonly (string | undefined)[] {
  return [variant.opcion1_valor, variant.opcion2_valor, variant.opcion3_valor];
}

function buildOptions(variants: readonly VariantRow[]): readonly DraftOption[] {
  const [first] = variants;
  if (first === undefined) return [];
  return optionNames(first).flatMap((name, index) =>
    name === undefined
      ? []
      : [
          {
            sourceRow: first.sourceRow,
            name,
            values: [...new Set(variants.flatMap((variant) => optionValues(variant)[index] ?? []))],
          },
        ],
  );
}

function buildVariant(row: VariantRow): DraftVariant {
  return {
    sourceRow: row.sourceRow,
    sku: required(row.sku),
    price: required(row.price),
    compareAtPrice: row.compareAtPrice,
    barcode: row.barcode,
    optionValues: optionValues(row).flatMap((value) => value ?? []),
    inventory: {
      tracked: row.manageInventory ?? false,
      quantity: row.stock,
      location: row.location,
    },
  };
}

function buildImages(rows: readonly ImageRow[]): readonly DraftImage[] {
  const ordered = rows.map((row) => ({ row, position: required(row.order) }));
  ordered.sort((left, right) => left.position - right.position);
  return ordered.map(({ row, position }, index) => ({
    sourceRow: row.sourceRow,
    path: required(row.path),
    position,
    cover: index === 0,
    alt: row.alt,
    variantSku: row.variantSku,
  }));
}

/** Builds the draft only when the report has no errors; otherwise returns `undefined`. */
export function buildCatalogDraft(
  errorCount: number,
  products: readonly ProductRow[],
  variants: readonly VariantRow[],
  images: readonly ImageRow[],
): CatalogDraft | undefined {
  if (errorCount > 0) return undefined;
  const built: DraftProduct[] = products.map((product) => {
    const own = variants.filter(({ productKey }) => productKey === product.productKey);
    return {
      sourceRow: product.sourceRow,
      productKey: required(product.productKey),
      handle: required(product.handle),
      title: required(product.title),
      tags: product.tags ?? [],
      options: buildOptions(own),
      variants: own.map(buildVariant),
      images: buildImages(images.filter(({ productKey }) => productKey === product.productKey)),
    };
  });
  return { products: built };
}
