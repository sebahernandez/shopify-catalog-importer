import type {
  CreateProductInput,
  CreateProductResult,
  CreateVariantInput,
  MediaStatus,
} from '../../ports/shopify-gateway.port.js';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import type { productSetSchema } from './response-schemas.js';
import type { z } from 'zod';

const MEDIA_STATUSES: readonly MediaStatus[] = ['UPLOADED', 'PROCESSING', 'READY', 'FAILED'];

const variantInput = (variant: CreateVariantInput) => ({
  optionValues: variant.optionValues.map(({ optionName, name }) => ({ optionName, name })),
  price: variant.price,
  ...(variant.compareAtPrice !== undefined && { compareAtPrice: variant.compareAtPrice }),
  sku: variant.sku,
  ...(variant.barcode !== undefined && { barcode: variant.barcode }),
  inventoryItem: { tracked: variant.tracked, sku: variant.sku },
  ...(variant.inventory !== undefined && {
    inventoryQuantities: [
      {
        locationId: variant.inventory.locationId,
        name: 'available',
        quantity: variant.inventory.quantity,
      },
    ],
  }),
});

/** The `ProductSetInput` variable. Products are always created as drafts. */
export const productSetVariables = (input: CreateProductInput): { input: unknown } => ({
  input: {
    title: input.title,
    handle: input.handle,
    ...(input.descriptionHtml !== undefined && { descriptionHtml: input.descriptionHtml }),
    ...(input.vendor !== undefined && { vendor: input.vendor }),
    ...(input.productType !== undefined && { productType: input.productType }),
    tags: [...input.tags],
    status: 'DRAFT',
    productOptions: input.options.map(({ name, values }) => ({
      name,
      values: values.map((value) => ({ name: value })),
    })),
    variants: input.variants.map(variantInput),
    files: input.images.map(({ url, alt }) => ({
      originalSource: url,
      contentType: 'IMAGE',
      ...(alt !== undefined && { alt }),
    })),
  },
});

/**
 * Maps the parsed response. A product with no user errors, or a product alongside non-blocking
 * ones, is `created`. No product and at least one user error is `rejected`. No product and no
 * user error says nothing about the outcome, so it is an unreadable response.
 */
export const toCreateProductResult = (
  parsed: z.infer<typeof productSetSchema>,
): CreateProductResult => {
  const { product, userErrors } = parsed.productSet;
  const errors = userErrors.map(({ field, code }) => ({ field, code }));
  if (product !== null) {
    return {
      kind: 'created',
      product: {
        id: product.id,
        handle: product.handle,
        variants: product.variants.nodes,
        media: product.media.nodes.map(({ id, status }) => ({
          id,
          status: MEDIA_STATUSES.find((known) => known === status) ?? 'UNKNOWN',
        })),
      },
      userErrors: errors,
    };
  }
  if (errors.length === 0) throw new ShopifyGatewayError('INVALID_RESPONSE');
  return { kind: 'rejected', userErrors: errors };
};
