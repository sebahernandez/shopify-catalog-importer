import { describe, expect, it } from 'vitest';
import { parseShopDomain, type ShopDomain } from '../../domain/shop-domain.js';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import { scriptedFetch, type ScriptStep } from '../../test-support/scripted-fetch.js';
import { createShopifyHttpTransport } from './shopify-http-transport.js';
import { shopifyUrls } from './shopify-urls.js';
import { MAX_BODY_BYTES, REQUEST_TIMEOUT_MS } from './transport-limits.js';

const parsed = parseShopDomain('mystore.myshopify.com');
if (!parsed.ok) throw new Error('fixture domain must parse');
const domain: ShopDomain = parsed.domain;
const request = shopifyUrls.graphql(domain, '2026-10');
const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };
const bytes = (size: number) => new Uint8Array(size).fill(0x20);

const setup = (steps: readonly ScriptStep[], timeoutSignal?: (ms: number) => AbortSignal) => {
  const { fetch, calls } = scriptedFetch(steps);
  const timeouts: number[] = [];
  const transport = createShopifyHttpTransport({
    fetchFn: fetch,
    timeoutSignal: (ms) => {
      timeouts.push(ms);
      return timeoutSignal ? timeoutSignal(ms) : new AbortController().signal;
    },
  });
  return { transport, calls, timeouts };
};
const send = (transport: ReturnType<typeof setup>['transport']) =>
  transport.post(request, { headers: { 'x-test': '1' }, body: '{}' });
const failure = async (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected a rejection');
    },
    (error: unknown) => error as ShopifyGatewayError,
  );

describe('ShopifyHttpTransport', () => {
  it('posts with redirect error, the injected 15 s signal and the given headers and body', async () => {
    const { transport, calls, timeouts } = setup([
      { status: 200, headers: JSON_HEADERS, body: '{"a":1}' },
    ]);
    const result = await send(transport);
    expect(REQUEST_TIMEOUT_MS).toBe(15_000);
    expect(timeouts).toEqual([15_000]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(request.url);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.init.redirect).toBe('error');
    expect(calls[0]?.init.signal).toBeInstanceOf(AbortSignal);
    expect(calls[0]?.headers['x-test']).toBe('1');
    expect(calls[0]?.body).toBe('{}');
    expect(result.status).toBe(200);
    expect(result.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(result.body).toEqual({ kind: 'json', value: { a: 1 } });
  });

  it('refuses a forged request before fetch is called', async () => {
    const { transport, calls } = setup([]);
    const forged = { url: 'https://evil.example/' } as unknown as typeof request;
    await expect(transport.post(forged, { headers: {}, body: '' })).rejects.toBeInstanceOf(
      TypeError,
    );
    expect(calls).toHaveLength(0);
  });

  it('gives TIMEOUT when a fetch that never resolves is aborted by the injected signal', async () => {
    const controller = new AbortController();
    const { transport } = setup([{ never: true }], () => controller.signal);
    const pending = failure(send(transport));
    controller.abort(new DOMException('timed out', 'TimeoutError'));
    const error = await pending;
    expect(error).toBeInstanceOf(ShopifyGatewayError);
    expect(error.kind).toBe('TIMEOUT');
    expect(error.cause).toBeUndefined();
  });

  it('gives TIMEOUT when the signal aborts in the middle of the body', async () => {
    const controller = new AbortController();
    const { transport } = setup(
      [{ status: 200, headers: JSON_HEADERS, chunks: [bytes(4), bytes(4)], hangAfter: 1 }],
      () => controller.signal,
    );
    const pending = failure(send(transport));
    await new Promise((resolve) => setTimeout(resolve, 5));
    controller.abort(new DOMException('timed out', 'TimeoutError'));
    expect((await pending).kind).toBe('TIMEOUT');
  });

  it.each(['TimeoutError', 'AbortError'])(
    'classifies a %s rejection as TIMEOUT (VS2)',
    async (name) => {
      const { transport } = setup([{ throws: new DOMException('stopped', name) }]);
      expect((await failure(send(transport))).kind).toBe('TIMEOUT');
    },
  );

  it('classifies the real AbortSignal.timeout error as TIMEOUT (VS2)', async () => {
    const { transport } = setup([{ never: true }], (ms) => AbortSignal.timeout(ms / 15_000));
    expect((await failure(send(transport))).kind).toBe('TIMEOUT');
  });

  it('gives NETWORK without leaking the URL or the cause', async () => {
    const cause = Object.assign(new Error('getaddrinfo ENOTFOUND mystore.myshopify.com'), {
      code: 'ENOTFOUND',
    });
    const { transport } = setup([
      { throws: new TypeError(`fetch failed for ${request.url}`, { cause }) },
    ]);
    const error = await failure(send(transport));
    expect(error.kind).toBe('NETWORK');
    expect(error.cause).toBeUndefined();
    const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
    expect(serialized).not.toContain('myshopify');
    expect(serialized).not.toContain('ENOTFOUND');
  });

  it('gives NETWORK on a refused redirect with no second request', async () => {
    const { transport, calls } = setup([
      { throws: new TypeError('fetch failed', { cause: new Error('unexpected redirect') }) },
    ]);
    expect((await failure(send(transport))).kind).toBe('NETWORK');
    expect(calls).toHaveLength(1);
  });

  it('reads a body of exactly 2,097,152 bytes (VS3)', async () => {
    expect(MAX_BODY_BYTES).toBe(2_097_152);
    const head = new TextEncoder().encode('{"a":"');
    const tail = new TextEncoder().encode('"}');
    const filler = new Uint8Array(MAX_BODY_BYTES - head.length - tail.length).fill(0x78);
    const { transport, calls } = setup([
      { status: 200, headers: JSON_HEADERS, chunks: [head, filler, tail] },
    ]);
    const result = await send(transport);
    expect(result.body.kind).toBe('json');
    expect(calls[0]?.pulledBytes).toBe(MAX_BODY_BYTES);
    expect(calls[0]?.cancelled).toBe(false);
  });

  it('flags 2,097,153 bytes as oversize and cancels the stream without reading the rest (VS3)', async () => {
    const chunk = 65_536;
    const chunks = Array.from({ length: 40 }, () => bytes(chunk));
    chunks[31] = bytes(chunk + 1);
    const { transport, calls } = setup([{ status: 200, headers: JSON_HEADERS, chunks }]);
    const result = await send(transport);
    expect(result.body).toEqual({ kind: 'flagged', reason: 'OVERSIZE' });
    expect(calls[0]?.cancelled).toBe(true);
    expect(calls[0]?.pulledBytes).toBeLessThanOrEqual(MAX_BODY_BYTES + chunk + 1);
    expect(calls[0]?.pulledBytes).toBeLessThan(chunks.length * chunk);
  });

  it('flags text/html and unparseable JSON, keeping status and headers', async () => {
    const html = setup([
      { status: 502, headers: { 'content-type': 'text/html' }, body: '<p>x</p>' },
    ]);
    const htmlResult = await send(html.transport);
    expect(htmlResult.status).toBe(502);
    expect(htmlResult.body).toEqual({ kind: 'flagged', reason: 'NOT_JSON' });
    const bad = setup([{ status: 200, headers: JSON_HEADERS, body: '{oops' }]);
    expect((await send(bad.transport)).body).toEqual({ kind: 'flagged', reason: 'UNPARSEABLE' });
  });

  it('never calls the global fetch', async () => {
    const original = globalThis.fetch;
    let globalCalls = 0;
    globalThis.fetch = () => {
      globalCalls += 1;
      throw new Error('global fetch must not be used');
    };
    try {
      const { transport } = setup([{ status: 200, headers: JSON_HEADERS, body: '{}' }]);
      await send(transport);
    } finally {
      globalThis.fetch = original;
    }
    expect(globalCalls).toBe(0);
  });
});
