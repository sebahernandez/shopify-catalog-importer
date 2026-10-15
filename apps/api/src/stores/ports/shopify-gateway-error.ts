import { isRetryableKind } from '@importer/contracts';
import type { ExchangeFailureReason, ShopifyErrorKind } from '@importer/contracts';

const MESSAGES: Record<ShopifyErrorKind, string> = {
  AUTH_FAILED: 'Shopify rejected the credentials.',
  SCOPE_MISSING: 'The app lacks a required access scope.',
  SHOP_UNAVAILABLE: 'The shop is unavailable.',
  STORE_NOT_FOUND: 'Shopify does not know this shop.',
  THROTTLED: 'Shopify throttled the request.',
  QUERY_TOO_COSTLY: 'The query exceeds the Shopify cost limit.',
  SERVER_ERROR: 'Shopify reported a server error.',
  VERSION_UNSUPPORTED: 'The API version is not supported.',
  NETWORK: 'The request could not reach Shopify.',
  TIMEOUT: 'The request to Shopify timed out.',
  INVALID_RESPONSE: 'Shopify returned an unreadable response.',
  GRAPHQL_ERROR: 'Shopify reported a GraphQL error.',
  CREDENTIAL_EXCHANGE_FAILED: 'The credential exchange with Shopify failed.',
};

/**
 * Every gateway failure. It keeps only the classification: no body, headers, URL or cause,
 * because Shopify responses can echo request data.
 */
export class ShopifyGatewayError extends Error {
  readonly kind: ShopifyErrorKind;
  readonly retryable: boolean;
  declare readonly retryAfterMs?: number;
  declare readonly reason?: ExchangeFailureReason;

  constructor(
    kind: ShopifyErrorKind,
    details: { readonly retryAfterMs?: number; readonly reason?: ExchangeFailureReason } = {},
  ) {
    super(MESSAGES[kind]);
    if (details.reason !== undefined && kind !== 'CREDENTIAL_EXCHANGE_FAILED') {
      throw new TypeError('reason is only valid for CREDENTIAL_EXCHANGE_FAILED');
    }
    this.name = 'ShopifyGatewayError';
    this.kind = kind;
    this.retryable = isRetryableKind(kind);
    if (details.retryAfterMs !== undefined) this.retryAfterMs = details.retryAfterMs;
    if (details.reason !== undefined) this.reason = details.reason;
  }
}
