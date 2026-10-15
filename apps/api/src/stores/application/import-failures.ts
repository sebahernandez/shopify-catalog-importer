import type { ImportFailureCode, ImportProductResult } from '@importer/contracts';
import { ShopifyGatewayError } from '../ports/shopify-gateway-error.js';
import type { ProductUserError } from '../ports/shopify-gateway.port.js';

type Failure = Extract<ImportProductResult, { status: 'failed' }>['failure'];

/** Fixed texts: nothing from the workbook, from Shopify or from the credentials is ever echoed. */
const MESSAGES: Record<ImportFailureCode, string> = {
  SHOPIFY_REJECTED: 'Shopify refused the product.',
  HANDLE_TAKEN: 'The handle is already used by another product in the store.',
  LOCATION_NOT_FOUND: 'The location is not an active location of the store.',
  LOCATION_AMBIGUOUS: 'The location name matches more than one active location of the store.',
  LOCATION_REQUIRED:
    'The variant has no location and the store does not have exactly one active location.',
  TOO_MANY_VARIANTS: 'The product has more variants than Shopify allows.',
  PRODUCT_INVALID: 'The product could not be built from the workbook data.',
  SHOPIFY_ERROR: 'Shopify answered with an error. Nothing was created.',
  STORE_ACCESS_FAILED:
    'Shopify refused access to the store (credentials, access scopes or shop state). Nothing was created.',
  THROTTLED: 'Shopify throttled the request. Nothing was created.',
  OUTCOME_UNKNOWN:
    'No readable answer arrived, so the product may exist in the store. Check the store before importing it again.',
  NOT_ATTEMPTED: 'The import stopped before this product was sent.',
};

export const failure = (code: ImportFailureCode, details: Failure['details'] = []): Failure => ({
  code,
  message: MESSAGES[code],
  details,
});

/** Only well-formed Shopify identifiers pass: a field path or code could otherwise carry free text. */
const SAFE_TOKEN = /^[A-Za-z0-9_]{1,64}$/;
const safeCode = (code: string | null): string | null =>
  code !== null && SAFE_TOKEN.test(code) ? code : null;
const safeField = (field: readonly string[] | null): string | null => {
  if (field === null || field.length === 0 || field.length > 8) return null;
  return field.every((part) => SAFE_TOKEN.test(part)) ? field.join('.') : null;
};

const isHandleTaken = ({ field, code }: ProductUserError): boolean =>
  code === 'TAKEN' && field?.at(-1) === 'handle';

/** A rejection (no product created) as a per-product failure. */
export const failureOfRejection = (userErrors: readonly ProductUserError[]): Failure => {
  const details = userErrors.slice(0, 20).map((error) => ({
    field: safeField(error.field),
    code: safeCode(error.code),
  }));
  return failure(userErrors.some(isHandleTaken) ? 'HANDLE_TAKEN' : 'SHOPIFY_REJECTED', details);
};

export interface GatewayFailure {
  readonly failure: Failure;
  /** True when the error affects every product, so the run must stop. */
  readonly stop: boolean;
}

/**
 * Classifies anything the gateway threw. A kind that proves nothing was created, and is specific
 * to this product, lets the run go on; every other one stops it. Unknown errors are treated as an
 * unknown outcome and never described.
 */
export const failureOfError = (error: unknown): GatewayFailure => {
  if (!(error instanceof ShopifyGatewayError)) {
    return { failure: failure('OUTCOME_UNKNOWN'), stop: true };
  }
  switch (error.kind) {
    case 'GRAPHQL_ERROR':
    case 'QUERY_TOO_COSTLY':
      return { failure: failure('SHOPIFY_ERROR'), stop: false };
    case 'THROTTLED':
      return { failure: failure('THROTTLED'), stop: true };
    case 'AUTH_FAILED':
    case 'SCOPE_MISSING':
    case 'SHOP_UNAVAILABLE':
    case 'STORE_NOT_FOUND':
    case 'VERSION_UNSUPPORTED':
    case 'CREDENTIAL_EXCHANGE_FAILED':
      return { failure: failure('STORE_ACCESS_FAILED'), stop: true };
    case 'SERVER_ERROR':
    case 'NETWORK':
    case 'TIMEOUT':
    case 'INVALID_RESPONSE':
      return { failure: failure('OUTCOME_UNKNOWN'), stop: true };
  }
};
