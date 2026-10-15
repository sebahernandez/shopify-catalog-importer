import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { parseShopDomain } from '../../domain/shop-domain.js';
import type { StoreConnection } from '../../ports/shopify-gateway.port.js';
import type { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import { scriptedFetch, type ScriptStep } from '../../test-support/scripted-fetch.js';
import { createShopifyGraphqlClient } from './shopify-graphql-client.js';

const TOKEN = 'shpat_CANARY_TOKEN_123';
const parsed = parseShopDomain('mystore.myshopify.com');
if (!parsed.ok) throw new Error('fixture domain must parse');
const connection = (apiVersion = '2026-10'): StoreConnection => ({
  storeId: 'store-1',
  shopDomain: parsed.domain,
  apiVersion,
  credentials: {
    authKind: 'static_token',
    accessToken: () => Promise.resolve(TOKEN),
    refreshAfterRejection: () => Promise.resolve(null),
  },
});
const JSON_HEADERS = { 'content-type': 'application/json' };
const ok = (body: unknown, headers: Record<string, string> = {}): ScriptStep => ({
  status: 200,
  headers: { ...JSON_HEADERS, ...headers },
  body: JSON.stringify(body),
});
const schema = z.object({ shop: z.object({ id: z.string() }) });

const setup = (steps: ScriptStep[]) => {
  const { fetch, calls } = scriptedFetch(steps);
  const observed: unknown[] = [];
  const client = createShopifyGraphqlClient({
    fetchFn: fetch,
    timeoutSignal: () => new AbortController().signal,
    onThrottleStatus: (storeId, status) => observed.push([storeId, status]),
  });
  const run = (conn = connection()) =>
    client.execute({
      connection: conn,
      query: 'query { shop { id } }',
      variables: { a: 1 },
      schema,
    });
  return { run, calls, observed };
};
const failure = async (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected a rejection');
    },
    (error: unknown) => error as ShopifyGatewayError,
  );

describe('ShopifyGraphqlClient', () => {
  it('sends one POST to the configured version URL with the three headers and a JSON body', async () => {
    const { run, calls } = setup([
      ok({ data: { shop: { id: 'a' } } }),
      ok({ data: { shop: { id: 'a' } } }),
    ]);
    const globalFetch = vi.spyOn(globalThis, 'fetch');
    await run();
    await run(connection('2027-01'));
    expect(globalFetch).not.toHaveBeenCalled();
    globalFetch.mockRestore();
    expect(calls.map((call) => call.url)).toEqual([
      'https://mystore.myshopify.com/admin/api/2026-10/graphql.json',
      'https://mystore.myshopify.com/admin/api/2027-01/graphql.json',
    ]);
    const call = calls[0];
    expect(call?.method).toBe('POST');
    expect(call?.headers['content-type']).toBe('application/json');
    expect(call?.headers.accept).toBe('application/json');
    expect(call?.headers['x-shopify-access-token']).toBe(TOKEN);
    expect(JSON.parse(String(call?.body))).toEqual({
      query: 'query { shop { id } }',
      variables: { a: 1 },
    });
    expect(call?.url + String(call?.body)).not.toContain(TOKEN);
  });

  it('returns the data and apiVersionUsed from the header: match, fall-forward, absent', async () => {
    const data = { data: { shop: { id: 'a' } } };
    const { run } = setup([
      ok(data, { 'x-shopify-api-version': '2026-10' }),
      ok(data, { 'x-shopify-api-version': '2027-01' }),
      ok(data),
    ]);
    expect(await run()).toEqual({ value: { shop: { id: 'a' } }, apiVersionUsed: '2026-10' });
    expect((await run()).apiVersionUsed).toBe('2027-01');
    expect((await run()).apiVersionUsed).toBeNull();
  });

  it('hands a well-formed throttleStatus to the observer, from success and error responses', async () => {
    const status = { maximumAvailable: 1000, currentlyAvailable: 900, restoreRate: 50 };
    const cost = { cost: { throttleStatus: status } };
    const { run, observed } = setup([
      ok({ data: { shop: { id: 'a' } }, extensions: cost }),
      ok({ errors: [{ message: 'x' }], extensions: cost }),
    ]);
    await run();
    await failure(run());
    expect(observed).toEqual([
      ['store-1', status],
      ['store-1', status],
    ]);
  });

  it('ignores a malformed cost block', async () => {
    const { run, observed } = setup([
      ok({
        data: { shop: { id: 'a' } },
        extensions: { cost: { throttleStatus: { restoreRate: 'x' } } },
      }),
    ]);
    await run();
    expect(observed).toEqual([]);
  });

  it('classifies failures without leaking the token and maps schema mismatch to INVALID_RESPONSE', async () => {
    const { run } = setup([
      ok({ data: { shop: { id: 5 } } }),
      {
        status: 401,
        headers: JSON_HEADERS,
        body: JSON.stringify({ errors: [{ message: TOKEN }] }),
      },
    ]);
    expect((await failure(run())).kind).toBe('INVALID_RESPONSE');
    const error = await failure(run());
    expect(error.kind).toBe('AUTH_FAILED');
    expect(JSON.stringify(error) + error.message).not.toContain(TOKEN);
  });

  it('maps transport failures to causeless gateway errors', async () => {
    const { run } = setup([
      { throws: Object.assign(new Error('https://x token'), { name: 'TimeoutError' }) },
    ]);
    const error = await failure(run());
    expect(error.kind).toBe('TIMEOUT');
    expect(error.cause).toBeUndefined();
  });
});
