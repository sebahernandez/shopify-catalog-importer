import { z } from 'zod';
import type { GatewayRead, StoreConnection } from '../../ports/shopify-gateway.port.js';
import { classifyResponse } from './classify-response.js';
import { createShopifyHttpTransport, type TransportResponse } from './shopify-http-transport.js';
import { shopifyUrls } from './shopify-urls.js';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';

export const ThrottleStatus = z.object({
  maximumAvailable: z.number(),
  currentlyAvailable: z.number(),
  restoreRate: z.number(),
});
export type ThrottleStatus = z.infer<typeof ThrottleStatus>;

export interface ShopifyGraphqlClientOptions {
  readonly fetchFn: (url: string, init: RequestInit) => Promise<Response>;
  readonly timeoutSignal?: (ms: number) => AbortSignal;
  /** Receives a well-formed `extensions.cost.throttleStatus` from any response. */
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

/** One attempt per call: retry, wait and forced refresh arrive in U8. */
export const createShopifyGraphqlClient = (options: ShopifyGraphqlClientOptions) => {
  const transport = createShopifyHttpTransport({
    fetchFn: options.fetchFn,
    ...(options.timeoutSignal && { timeoutSignal: options.timeoutSignal }),
  });
  return {
    async execute<T>(input: {
      readonly connection: StoreConnection;
      readonly query: string;
      readonly variables: Record<string, unknown>;
      readonly schema: z.ZodType<T>;
    }): Promise<GatewayRead<T>> {
      const { connection } = input;
      const token = await connection.credentials.accessToken();
      const response = await transport.post(
        shopifyUrls.graphql(connection.shopDomain, connection.apiVersion),
        {
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            'x-shopify-access-token': token,
          },
          body: JSON.stringify({ query: input.query, variables: input.variables }),
        },
      );
      const status = throttleStatusOf(response);
      if (status !== undefined) options.onThrottleStatus?.(connection.storeId, status);
      const classified = classifyResponse(response);
      if (!classified.ok) throw classified.error;
      const data = input.schema.safeParse(classified.data);
      if (!data.success) throw new ShopifyGatewayError('INVALID_RESPONSE');
      return { value: data.data, apiVersionUsed: response.headers.get('x-shopify-api-version') };
    },
  };
};
