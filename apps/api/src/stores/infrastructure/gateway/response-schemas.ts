import { z } from 'zod';

export const shopInfoSchema = z.object({
  shop: z.object({
    id: z.string().min(1),
    name: z.string(),
    myshopifyDomain: z.string().min(1),
    currencyCode: z.string().min(1),
    plan: z.object({
      publicDisplayName: z.string(),
      partnerDevelopment: z.boolean(),
      shopifyPlus: z.boolean(),
    }),
  }),
});

export const grantedScopesSchema = z.object({
  currentAppInstallation: z.object({ accessScopes: z.array(z.object({ handle: z.string() })) }),
});

export const locationsPageSchema = z.object({
  locations: z.object({
    nodes: z.array(
      z.object({
        id: z.string().min(1),
        name: z.string(),
        isActive: z.boolean(),
        fulfillsOnlineOrders: z.boolean(),
      }),
    ),
    pageInfo: z.object({ hasNextPage: z.boolean(), endCursor: z.string().nullable() }),
  }),
});

const userErrorSchema = z.object({
  field: z.array(z.string()).nullable(),
  message: z.string(),
  code: z.string().nullable(),
});

/** `product` is null when Shopify created nothing; `userErrors` is always present. */
export const productSetSchema = z.object({
  productSet: z.object({
    product: z
      .object({
        id: z.string().min(1),
        handle: z.string(),
        variants: z.object({
          nodes: z.array(z.object({ id: z.string().min(1), sku: z.string().nullable() })),
        }),
        media: z.object({
          nodes: z.array(z.object({ id: z.string().min(1), status: z.string() })),
        }),
      })
      .nullable(),
    userErrors: z.array(userErrorSchema),
  }),
});
