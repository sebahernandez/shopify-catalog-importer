import { parseShopDomain } from '../domain/shop-domain.js';
import type { StoreConnection } from '../ports/shopify-gateway.port.js';
import { createHttpShopifyGateway } from '../infrastructure/gateway/http-shopify-gateway.js';
import { createShopifyGraphqlClient } from '../infrastructure/gateway/shopify-graphql-client.js';
import { scriptedFetch, type ScriptStep } from './scripted-fetch.js';

const domainOf = (host: string) => {
  const parsed = parseShopDomain(host);
  if (!parsed.ok) throw new Error('fixture domain must parse');
  return parsed.domain;
};
export const connectionFor = (
  host: string,
  token: string,
  apiVersion = '2026-10',
): StoreConnection => ({
  storeId: host,
  shopDomain: domainOf(host),
  apiVersion,
  credentials: {
    authKind: 'static_token',
    accessToken: () => Promise.resolve(token),
    refreshAfterRejection: () => Promise.resolve(null),
  },
});
export const okStep = (body: unknown, headers: Record<string, string> = {}): ScriptStep => ({
  status: 200,
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
export const gatewayOver = (steps: ScriptStep[]) => {
  const { fetch, calls } = scriptedFetch(steps);
  const client = createShopifyGraphqlClient({
    fetchFn: fetch,
    timeoutSignal: () => new AbortController().signal,
    sleep: () => Promise.resolve(),
    random: () => 0,
  });
  return { gateway: createHttpShopifyGateway(client), calls };
};
