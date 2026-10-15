import type { ImportFailureCode } from '@importer/contracts';
import type { ImportableProduct } from '../domain/importable-catalog.js';
import type { CreateProductInput, CreateVariantInput } from '../ports/shopify-gateway.port.js';
import type { LocationResolution } from './import-location-resolver.js';

/** Shopify allows up to 2048 variants per product (documented for the Admin API). */
export const MAX_VARIANTS = 2048;
/** Shopify allows up to 250 media per product. */
export const MAX_IMAGES = 250;

/** The option a product without options gets: Shopify's own default option and value. */
export const DEFAULT_OPTION = { name: 'Title', value: 'Default Title' } as const;

export type BuiltProduct =
  | {
      readonly ok: true;
      readonly input: CreateProductInput;
      readonly imagesSkipped: { readonly localFile: number; readonly overLimit: number };
    }
  | { readonly ok: false; readonly code: ImportFailureCode };

/** True when any variant of the product will send an inventory quantity (so it needs a location). */
export const needsLocation = (product: ImportableProduct): boolean =>
  product.variants.some(({ inventory }) => inventory.tracked && inventory.quantity !== undefined);

const variantOf = (
  product: ImportableProduct,
  index: number,
  resolve: (name: string | undefined) => LocationResolution,
): CreateVariantInput | { readonly code: ImportFailureCode } => {
  const variant = product.variants[index];
  if (variant === undefined) return { code: 'PRODUCT_INVALID' };
  const optionValues =
    product.options.length === 0
      ? [{ optionName: DEFAULT_OPTION.name, name: DEFAULT_OPTION.value }]
      : product.options.map(({ name }, position) => ({
          optionName: name,
          name: variant.optionValues[position] ?? '',
        }));
  if (optionValues.some(({ name }) => name === '')) return { code: 'PRODUCT_INVALID' };
  const { inventory } = variant;
  let stock: CreateVariantInput['inventory'];
  if (inventory.tracked && inventory.quantity !== undefined) {
    const location = resolve(inventory.location);
    if (!location.ok) return { code: location.code };
    stock = { locationId: location.id, quantity: inventory.quantity };
  }
  return {
    optionValues,
    price: variant.price.toString(),
    ...(variant.compareAtPrice !== undefined && {
      compareAtPrice: variant.compareAtPrice.toString(),
    }),
    sku: variant.sku,
    ...(variant.barcode !== undefined && { barcode: variant.barcode }),
    tracked: inventory.tracked,
    ...(stock !== undefined && { inventory: stock }),
  };
};

/**
 * Builds the gateway input of one draft product. A failure is a closed code, so the caller can
 * answer per product without Shopify being involved. Images keep their workbook order; local
 * files cannot be uploaded and are counted, as are images over Shopify's limit.
 */
export const buildProductInput = (
  product: ImportableProduct,
  resolve: (name: string | undefined) => LocationResolution,
): BuiltProduct => {
  if (product.variants.length === 0) return { ok: false, code: 'PRODUCT_INVALID' };
  if (product.variants.length > MAX_VARIANTS) return { ok: false, code: 'TOO_MANY_VARIANTS' };
  const variants: CreateVariantInput[] = [];
  for (let index = 0; index < product.variants.length; index++) {
    const built = variantOf(product, index, resolve);
    if ('code' in built) return { ok: false, code: built.code };
    variants.push(built);
  }
  const remote = product.images.filter(({ kind }) => kind === 'url');
  const sent = remote.slice(0, MAX_IMAGES);
  return {
    ok: true,
    input: {
      title: product.title,
      handle: product.handle,
      ...(product.descriptionHtml !== undefined && { descriptionHtml: product.descriptionHtml }),
      ...(product.vendor !== undefined && { vendor: product.vendor }),
      ...(product.productType !== undefined && { productType: product.productType }),
      tags: product.tags,
      options:
        product.options.length === 0
          ? [{ name: DEFAULT_OPTION.name, values: [DEFAULT_OPTION.value] }]
          : product.options.map(({ name, values }) => ({ name, values })),
      variants,
      images: sent.map(({ path, alt }) => ({ url: path, ...(alt !== undefined && { alt }) })),
    },
    imagesSkipped: {
      localFile: product.images.length - remote.length,
      overLimit: remote.length - sent.length,
    },
  };
};
