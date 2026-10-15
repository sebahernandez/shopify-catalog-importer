import { z } from 'zod';
import { describe, expect, it, vi } from 'vitest';
import { parseShopDomain } from '../../domain/shop-domain.js';
import type { StoreConnection } from '../../ports/shopify-gateway.port.js';
import type { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import { scriptedFetch, type ScriptStep } from '../../test-support/scripted-fetch.js';
import { createShopifyGraphqlClient } from './shopify-graphql-client.js';
import { createThrottleTracker } from './throttle-tracker.js';

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
  const waits: number[] = [];
  const tracker = createThrottleTracker({ nowMs: () => 0 });
  const client = createShopifyGraphqlClient({
    fetchFn: fetch,
    timeoutSignal: () => new AbortController().signal,
    onThrottleStatus: (storeId, status) => observed.push([storeId, status]),
    tracker,
    sleep: (ms) => {
      waits.push(ms);
      return Promise.resolve();
    },
    random: () => 0,
  });
  const run = (
    conn = connection(),
    extra: { estimatedCost?: number; retry?: 'safe' | 'none' } = {},
  ) =>
    client.execute({
      connection: conn,
      query: 'query { shop { id } }',
      variables: { a: 1 },
      schema,
      ...extra,
    });
  return { run, calls, observed, waits };
};

const refreshing = (
  authKind: 'static_token' | 'client_credentials',
  refresh: (rejected: string) => string | null,
): StoreConnection => ({
  ...connection(),
  credentials: {
    authKind,
    accessToken: () => Promise.resolve('old-token'),
    refreshAfterRejection: (rejected) => Promise.resolve(refresh(rejected)),
  },
});
const unauthorized: ScriptStep = { status: 401, headers: JSON_HEADERS, body: '{"errors":[]}' };
const serverError: ScriptStep = { status: 503, headers: JSON_HEADERS, body: '{}' };
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

  it('sleeps the tracker advice before sending and feeds every response to the tracker', async () => {
    const low = { maximumAvailable: 1000, currentlyAvailable: 100, restoreRate: 50 };
    const cost = { cost: { throttleStatus: low } };
    const { run, waits } = setup([
      ok({ data: { shop: { id: 'a' } }, extensions: cost }),
      ok({ data: { shop: { id: 'a' } } }),
    ]);
    await run(connection(), { estimatedCost: 300 });
    expect(waits).toEqual([]);
    await run(connection(), { estimatedCost: 300 });
    expect(waits).toEqual([4000]);
  });

  it('retries a safe read through the policy and never retries without a retry mode', async () => {
    const { run, calls, waits } = setup([
      serverError,
      ok({ data: { shop: { id: 'a' } } }),
      serverError,
    ]);
    await run(connection(), { retry: 'safe' });
    expect(calls).toHaveLength(2);
    expect(waits).toEqual([0]);
    expect((await failure(run())).kind).toBe('SERVER_ERROR');
    expect(calls).toHaveLength(3);
  });

  it('forces one credential refresh on AUTH_FAILED and retries once with the new token', async () => {
    const { run, calls } = setup([unauthorized, ok({ data: { shop: { id: 'a' } } })]);
    const seen: string[] = [];
    const conn = refreshing('client_credentials', (rejected) => {
      seen.push(rejected);
      return 'new-token';
    });
    await run(conn);
    expect(seen).toEqual(['old-token']);
    expect(calls.map((call) => call.headers['x-shopify-access-token'])).toEqual([
      'old-token',
      'new-token',
    ]);
  });

  it('gives AUTH_FAILED after exactly two requests and one refresh when the retry is also rejected', async () => {
    const { run, calls } = setup([unauthorized, unauthorized, unauthorized]);
    let refreshes = 0;
    const conn = refreshing('client_credentials', () => {
      refreshes++;
      return 'new-token';
    });
    expect((await failure(run(conn, { retry: 'safe' }))).kind).toBe('AUTH_FAILED');
    expect(calls).toHaveLength(2);
    expect(refreshes).toBe(1);
  });

  it('gives AUTH_FAILED after one request for a static token', async () => {
    const { run, calls } = setup([unauthorized, unauthorized]);
    expect((await failure(run(refreshing('static_token', () => null)))).kind).toBe('AUTH_FAILED');
    expect(calls).toHaveLength(1);
  });

  it.each([
    ['SCOPE_MISSING', { errors: [{ message: 'x', extensions: { code: 'ACCESS_DENIED' } }] }],
    ['THROTTLED', { errors: [{ message: 'x', extensions: { code: 'THROTTLED' } }] }],
  ])('never forces a refresh for %s', async (_kind, body) => {
    const { run } = setup([ok(body)]);
    let refreshes = 0;
    await failure(
      run(
        refreshing('client_credentials', () => {
          refreshes++;
          return 'n';
        }),
      ),
    );
    expect(refreshes).toBe(0);
  });
});
