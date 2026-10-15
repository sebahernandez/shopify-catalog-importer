import type { ShopifyErrorKind } from '@importer/contracts';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import type { TransportResponse } from './shopify-http-transport.js';

export type ClassifiedResponse =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly error: ShopifyGatewayError };

const fail = (
  kind: ShopifyErrorKind,
  retryAfterMs?: number,
): { readonly ok: false; readonly error: ShopifyGatewayError } => ({
  ok: false,
  error: new ShopifyGatewayError(kind, retryAfterMs === undefined ? {} : { retryAfterMs }),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Non-empty `errors` array of a JSON object body, or null. */
const errorsOf = (body: TransportResponse['body']): unknown[] | null => {
  if (body.kind !== 'json' || !isRecord(body.value)) return null;
  const { errors } = body.value;
  return Array.isArray(errors) && errors.length > 0 ? errors : null;
};

const STATUS_KINDS: Record<number, ShopifyErrorKind> = {
  401: 'AUTH_FAILED',
  402: 'SHOP_UNAVAILABLE',
  403: 'SHOP_UNAVAILABLE',
  423: 'SHOP_UNAVAILABLE',
  404: 'STORE_NOT_FOUND',
};

/** Seconds from a non-negative integer `Retry-After`, as milliseconds; anything else is ignored. */
const retryAfterMs = (headers: Headers): number | undefined => {
  const value = headers.get('retry-after');
  return value !== null && /^\d+$/.test(value) ? Number(value) * 1000 : undefined;
};

const codeOf = (entry: unknown): string | undefined => {
  if (!isRecord(entry) || !isRecord(entry.extensions)) return undefined;
  return typeof entry.extensions.code === 'string' ? entry.extensions.code : undefined;
};

const isInvalidKey = (entry: unknown): boolean =>
  isRecord(entry) &&
  typeof entry.message === 'string' &&
  entry.message.includes('Invalid API key or access token');

/** Rules in precedence order; the first rule matched by any entry wins. */
const BODY_RULES: ReadonlyArray<[ShopifyErrorKind, (entry: unknown) => boolean]> = [
  ['THROTTLED', (entry) => codeOf(entry) === 'THROTTLED'],
  ['AUTH_FAILED', isInvalidKey],
  ['SCOPE_MISSING', (entry) => codeOf(entry) === 'ACCESS_DENIED'],
  ['SHOP_UNAVAILABLE', (entry) => codeOf(entry) === 'SHOP_INACTIVE'],
  ['QUERY_TOO_COSTLY', (entry) => codeOf(entry) === 'MAX_COST_EXCEEDED'],
  ['SERVER_ERROR', (entry) => codeOf(entry) === 'INTERNAL_SERVER_ERROR'],
];

const classifyErrors = (errors: unknown[]): ShopifyErrorKind =>
  BODY_RULES.find(([, matches]) => errors.some(matches))?.[0] ?? 'GRAPHQL_ERROR';

/**
 * Pure and status-first (design D14, rows 3 to 17 except the schema row). The result never holds
 * any part of the body; on success only the `data` value is handed on.
 */
export const classifyResponse = (response: TransportResponse): ClassifiedResponse => {
  const { status, body } = response;
  if (status < 200 || status >= 300) {
    if (status === 429) return fail('THROTTLED', retryAfterMs(response.headers));
    if (status >= 500) return fail('SERVER_ERROR');
    const kind = STATUS_KINDS[status];
    if (kind !== undefined) return fail(kind);
    return fail(errorsOf(body) === null ? 'INVALID_RESPONSE' : 'GRAPHQL_ERROR');
  }
  if (body.kind !== 'json' || !isRecord(body.value)) return fail('INVALID_RESPONSE');
  const errors = errorsOf(body);
  if (errors !== null) return fail(classifyErrors(errors));
  if (!('data' in body.value)) return fail('INVALID_RESPONSE');
  return { ok: true, data: body.value.data };
};
