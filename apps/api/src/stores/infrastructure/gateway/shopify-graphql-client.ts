import { z } from 'zod';
import type { GatewayRead, StoreConnection } from '../../ports/shopify-gateway.port.js';
import { classifyResponse } from './classify-response.js';
import { createShopifyHttpTransport, type TransportResponse } from './shopify-http-transport.js';
import { shopifyUrls } from './shopify-urls.js';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import { defaultGatewayRuntime } from './gateway-runtime.js';
import { withRetry } from './retry-policy.js';
import { ThrottleStatus } from './throttle-status.js';
import { createThrottleTracker } from './throttle-tracker.js';

export interface ShopifyGraphqlClientOptions {
  readonly fetchFn: (url: string, init: RequestInit) => Promise<Response>;
  readonly timeoutSignal?: (ms: number) => AbortSignal;
  /** Receives a well-formed `extensions.cost.throttleStatus` from any response. */
  readonly sleep?: (ms: number) => Promise<void>;
  readonly random?: () => number;
  readonly tracker?: ReturnType<typeof createThrottleTracker>;
  readonly onThrottleStatus?: (storeId: string, status: ThrottleStatus) => void;
}

/** Reads the cost block from a parsed body; a malformed block is ignored. */
const throttleStatusOf = (response: TransportResponse): ThrottleStatus | undefined => {
  if (response.body.kind !== 'json') return undefined;
  const parsed = z
    .object({ extensions: z.object({ cost: z.object({ throttleStatus: ThrottleStatus }) }) })
    .safeParse(response.body.value);
  return parsed.success ? parsed.data.extensions.cost.throttleStatus : undefined;
};

/** Waits the tracker advice, sends, retries per D15 and forces one credential refresh per call. */
export const createShopifyGraphqlClient = (options: ShopifyGraphqlClientOptions) => {
  const runtime = defaultGatewayRuntime;
  const sleep = options.sleep ?? runtime.sleep;
  const random = options.random ?? runtime.random;
  const tracker = options.tracker ?? createThrottleTracker({ nowMs: runtime.nowMs });
  const transport = createShopifyHttpTransport({
    fetchFn: options.fetchFn,
    timeoutSignal: options.timeoutSignal ?? runtime.timeoutSignal,
  });
  return {
    async execute<T>(input: {
      readonly connection: StoreConnection;
      readonly query: string;
      readonly variables: Record<string, unknown>;
      readonly schema: z.ZodType<T>;
      readonly estimatedCost?: number;
      /** Absent means `'none'`. */
      readonly retry?: 'safe' | 'none';
    }): Promise<GatewayRead<T>> {
      const { connection } = input;
      const domain = connection.shopDomain;
      const send = async (token: string): Promise<GatewayRead<T>> => {
        const advice = tracker.waitTimeFor(domain, input.estimatedCost ?? 0);
        if (advice > 0) await sleep(advice);
        const response = await transport.post(shopifyUrls.graphql(domain, connection.apiVersion), {
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-shopify-access-token': token,
          },
          body: JSON.stringify({ query: input.query, variables: input.variables }),
        });
        const status = throttleStatusOf(response);
        if (status !== undefined) {
          tracker.observe(domain, status);
          options.onThrottleStatus?.(connection.storeId, status);
        }
        const classified = classifyResponse(response);
        if (!classified.ok) throw classified.error;
        const data = input.schema.safeParse(classified.data);
        if (!data.success) throw new ShopifyGatewayError('INVALID_RESPONSE');
        return { value: data.data, apiVersionUsed: response.headers.get('x-shopify-api-version') };
      };
      let token = await connection.credentials.accessToken();
      let refreshed = false;
      return withRetry(
        async () => {
          try {
            return await send(token);
          } catch (error) {
            if (
              !(error instanceof ShopifyGatewayError) ||
              error.kind !== 'AUTH_FAILED' ||
              refreshed
            ) {
              throw error;
            }
            refreshed = true;
            const fresh = await connection.credentials.refreshAfterRejection(token);
            if (fresh === null) throw error;
            token = fresh;
            return send(token);
          }
        },
        { retry: input.retry, sleep, random },
      );
    },
  };
};
