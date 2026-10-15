import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import { readCappedBody } from './capped-body-reader.js';
import { isShopifyRequest, type ShopifyRequest } from './shopify-request.js';
import { MAX_BODY_BYTES, REQUEST_TIMEOUT_MS } from './transport-limits.js';

export type TransportBody =
  | { readonly kind: 'json'; readonly value: unknown }
  | { readonly kind: 'flagged'; readonly reason: 'OVERSIZE' | 'NOT_JSON' | 'UNPARSEABLE' };

/** What U7b classifies: status first, then headers and the parsed-or-flagged body. */
export interface TransportResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly body: TransportBody;
}

export interface ShopifyHttpTransportOptions {
  readonly fetchFn: (url: string, init: RequestInit) => Promise<Response>;
  readonly timeoutSignal?: (ms: number) => AbortSignal;
}

const TIMEOUT_NAMES = new Set(['TimeoutError', 'AbortError']);

/** Maps any fetch or body failure to a causeless gateway error. */
const classify = (error: unknown): ShopifyGatewayError => {
  const name = typeof error === 'object' && error !== null ? (error as Error).name : undefined;
  return new ShopifyGatewayError(
    name !== undefined && TIMEOUT_NAMES.has(name) ? 'TIMEOUT' : 'NETWORK',
  );
};

const isJsonContentType = (value: string | null): boolean =>
  /^application\/json\s*(;|$)/i.test(value ?? '');

export const createShopifyHttpTransport = (options: ShopifyHttpTransportOptions) => ({
  /** A form POST: explicit url-encoded content type and a string body. Same failure rules as `post`. */
  postForm(request: ShopifyRequest, fields: Record<string, string>): Promise<TransportResponse> {
    return this.post(request, {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    });
  },
  /** POST only. Throws only TIMEOUT and NETWORK; everything else is returned for classification. */
  async post(
    request: ShopifyRequest,
    init: { readonly headers: Record<string, string>; readonly body: string },
  ): Promise<TransportResponse> {
    if (!isShopifyRequest(request)) throw new TypeError('Invalid Shopify request.');
    const signal = (options.timeoutSignal ?? AbortSignal.timeout.bind(AbortSignal))(
      REQUEST_TIMEOUT_MS,
    );
    try {
      const response = await options.fetchFn(request.url, {
        method: 'POST',
        headers: init.headers,
        body: init.body,
        redirect: 'error',
        signal,
      });
      const base = { status: response.status, headers: response.headers };
      if (!isJsonContentType(response.headers.get('content-type'))) {
        await response.body?.cancel().catch(() => undefined);
        return { ...base, body: { kind: 'flagged', reason: 'NOT_JSON' } };
      }
      const read = await readCappedBody(response.body, MAX_BODY_BYTES);
      if (read.kind === 'oversize')
        return { ...base, body: { kind: 'flagged', reason: 'OVERSIZE' } };
      try {
        return { ...base, body: { kind: 'json', value: JSON.parse(read.text) as unknown } };
      } catch {
        return { ...base, body: { kind: 'flagged', reason: 'UNPARSEABLE' } };
      }
    } catch (error) {
      throw classify(error);
    }
  },
});
