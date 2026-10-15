import { z } from 'zod';
import { ValidationReport } from './validation-report.js';

/** Why one product was not created. Closed set: the web maps each code to its own copy. */
export const IMPORT_FAILURE_CODES = z.enum([
  /** Shopify refused the product (validation problems). */
  'SHOPIFY_REJECTED',
  /** The handle is already used by another product in the store. */
  'HANDLE_TAKEN',
  /** A variant names a location that is not an active location of the store. */
  'LOCATION_NOT_FOUND',
  /** A variant names a location that matches more than one active location. */
  'LOCATION_AMBIGUOUS',
  /** A variant has no location and the store does not have exactly one active location. */
  'LOCATION_REQUIRED',
  /** The product has more variants than Shopify allows. */
  'TOO_MANY_VARIANTS',
  /** The product could not be built from the workbook data. */
  'PRODUCT_INVALID',
  /** Shopify answered with an error for this request; nothing was created. */
  'SHOPIFY_ERROR',
  /** Shopify refused the credentials, the scopes or the shop; nothing was created. */
  'STORE_ACCESS_FAILED',
  /** Shopify throttled the request; nothing was created. */
  'THROTTLED',
  /** No answer could be read, so the product may or may not exist in the store. */
  'OUTCOME_UNKNOWN',
  /** The import stopped before this product was sent. */
  'NOT_ATTEMPTED',
]);

export type ImportFailureCode = z.infer<typeof IMPORT_FAILURE_CODES>;

/** Media are processed after the product exists, so these can still change. */
export const IMPORT_MEDIA_STATUSES = z.enum([
  'UPLOADED',
  'PROCESSING',
  'READY',
  'FAILED',
  'UNKNOWN',
]);

export type ImportMediaStatus = z.infer<typeof IMPORT_MEDIA_STATUSES>;

const base = {
  productKey: z.string(),
  handle: z.string(),
};

export const ImportProductCreated = z.strictObject({
  ...base,
  status: z.literal('created'),
  /** The Shopify product id. Products are created as drafts. */
  productId: z.string().min(1),
  /** The handle Shopify stored; it can differ from the requested one. */
  shopifyHandle: z.string(),
  mediaStatuses: z.array(IMPORT_MEDIA_STATUSES),
  /** Images that were not sent: local files cannot be uploaded and Shopify takes at most 250. */
  imagesSkipped: z.strictObject({
    localFile: z.number().int().nonnegative(),
    overLimit: z.number().int().nonnegative(),
  }),
  /** Codes of non-blocking problems Shopify reported next to a created product. */
  warnings: z.array(z.string()),
});

export const ImportProductFailed = z.strictObject({
  ...base,
  status: z.literal('failed'),
  failure: z.strictObject({
    code: IMPORT_FAILURE_CODES,
    message: z.string(),
    /** Input paths and codes Shopify reported, for `SHOPIFY_REJECTED` and `HANDLE_TAKEN`. */
    details: z.array(z.strictObject({ field: z.string().nullable(), code: z.string().nullable() })),
  }),
});

export const ImportProductResult = z.discriminatedUnion('status', [
  ImportProductCreated,
  ImportProductFailed,
]);

export type ImportProductResult = z.infer<typeof ImportProductResult>;

/** The answer of `POST /api/stores/:id/import` when the workbook is valid and the run happened. */
export const ImportResponse = z.strictObject({
  totals: z.strictObject({
    products: z.number().int().nonnegative(),
    created: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
  }),
  /** True when an error that affects every product ended the run early. */
  stoppedEarly: z.boolean(),
  /** One entry per workbook product, in workbook order. */
  results: z.array(ImportProductResult),
});

export type ImportResponse = z.infer<typeof ImportResponse>;

/** The 422 answer when the workbook has errors: nothing was sent to Shopify. */
export const ImportRejected = z.object({
  error: z.object({ code: z.literal('WORKBOOK_INVALID'), message: z.string() }),
  report: ValidationReport,
});

export type ImportRejected = z.infer<typeof ImportRejected>;
