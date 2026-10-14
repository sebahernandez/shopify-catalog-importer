import { describe, expect, it, vi } from 'vitest';
import { HEALTH_PATH, HEALTH_TIMEOUT_MS, fetchHealth, toHealthResult } from './http-client';

const OK_BODY = { status: 'ok', database: 'up', shopifyApiVersion: '2026-10' };
const DEGRADED_BODY = { status: 'degraded', database: 'down', shopifyApiVersion: '2026-10' };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('toHealthResult (status code plus body to state)', () => {
  it('maps 200 with an ok body to ok and keeps the version', () => {
    expect(toHealthResult(200, OK_BODY)).toEqual({ state: 'ok', shopifyApiVersion: '2026-10' });
    expect(toHealthResult(200, { ...OK_BODY, shopifyApiVersion: '2031-07' })).toEqual({
      state: 'ok',
      shopifyApiVersion: '2031-07',
    });
  });

  it('maps 503 with a degraded body to degraded and keeps the version', () => {
    expect(toHealthResult(503, DEGRADED_BODY)).toEqual({
      state: 'degraded',
      shopifyApiVersion: '2026-10',
    });
  });

  it.each([
    ['200 with a degraded body', 200, DEGRADED_BODY],
    ['200 with ok and database down', 200, { ...OK_BODY, database: 'down' }],
    ['200 with degraded and database up', 200, { ...DEGRADED_BODY, database: 'up' }],
    ['503 with an ok body', 503, OK_BODY],
    ['503 with ok and database down', 503, { ...OK_BODY, database: 'down' }],
    ['503 with degraded and database up', 503, { ...DEGRADED_BODY, database: 'up' }],
    ['500 with a degraded body', 500, DEGRADED_BODY],
    ['502 with an ok body', 502, OK_BODY],
    ['404 with an ok body', 404, OK_BODY],
    ['204 with an ok body', 204, OK_BODY],
    ['0 (opaque response)', 0, OK_BODY],
    ['302 with an ok body', 302, OK_BODY],
    ['403 with an ApiError body', 403, { code: 'HOST_NOT_ALLOWED', message: 'No.' }],
    ['200 with a missing field', 200, { status: 'ok', database: 'up' }],
    ['200 with a numeric version', 200, { ...OK_BODY, shopifyApiVersion: 202610 }],
    ['200 with an unknown status word', 200, { ...OK_BODY, status: 'fine' }],
    ['200 with null', 200, null],
    ['200 with a string', 200, 'ok'],
    ['200 with an array', 200, [OK_BODY]],
    ['200 with undefined', 200, undefined],
  ])('fails closed to unreachable for %s', (_name, status, body) => {
    expect(toHealthResult(status, body)).toEqual({ state: 'unreachable' });
  });

  it('shows only a short, plain version string and drops anything else', () => {
    for (const odd of ['<img src=x onerror=alert(1)>', 'a b', '', 'x'.repeat(33), '2026-10\n']) {
      expect(toHealthResult(200, { ...OK_BODY, shopifyApiVersion: odd })).toEqual({ state: 'ok' });
    }
    expect(toHealthResult(200, { ...OK_BODY, shopifyApiVersion: 'unstable' })).toEqual({
      state: 'ok',
      shopifyApiVersion: 'unstable',
    });
  });
});

describe('fetchHealth', () => {
  it('asks the relative health route with a plain, credential-free, uncached GET', async () => {
    const fetchFn = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(json(200, OK_BODY)),
    );
    const controller = new AbortController();

    await fetchHealth({ fetchFn, signal: controller.signal });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe('/health');
    expect(HEALTH_PATH).toBe('/health');
    expect(init?.method).toBe('GET');
    expect(init?.credentials).toBe('omit');
    expect(init?.cache).toBe('no-store');
    expect(init?.redirect).toBe('error');
    expect(init?.headers).toBeUndefined();
    expect(init?.body).toBeUndefined();
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('answers ok for 200 with an ok body and degraded for 503 with a degraded body', async () => {
    const ok = await fetchHealth({ fetchFn: () => Promise.resolve(json(200, OK_BODY)) });
    const degraded = await fetchHealth({
      fetchFn: () => Promise.resolve(json(503, DEGRADED_BODY)),
    });
    expect(ok).toEqual({ state: 'ok', shopifyApiVersion: '2026-10' });
    expect(degraded).toEqual({ state: 'degraded', shopifyApiVersion: '2026-10' });
  });

  it.each([
    ['a degraded body with 200', () => json(200, DEGRADED_BODY)],
    ['an ok body with 503', () => json(503, OK_BODY)],
    ['an unknown status code', () => json(418, OK_BODY)],
    ['a redirect response', () => new Response(null, { status: 302, headers: { location: '/x' } })],
    [
      'an HTML error page from a proxy',
      () => new Response('<html>Bad gateway</html>', { status: 502 }),
    ],
    ['an HTML page with status 200', () => new Response('<html>hi</html>', { status: 200 })],
    ['an empty 200', () => new Response('', { status: 200 })],
    ['an empty 503', () => new Response(null, { status: 503 })],
    ['a body that is not JSON', () => new Response('ok', { status: 200 })],
    ['a body that fails the schema', () => json(200, { status: 'ok' })],
    ['a guard rejection', () => json(403, { code: 'HOST_NOT_ALLOWED', message: 'No.' })],
  ])('answers unreachable for %s', async (_name, make) => {
    await expect(fetchHealth({ fetchFn: () => Promise.resolve(make()) })).resolves.toEqual({
      state: 'unreachable',
    });
  });

  it('answers unreachable when fetch throws, rejects or refuses a redirect', async () => {
    const throwing = () => {
      throw new TypeError('Failed to fetch');
    };
    const rejecting = () => Promise.reject(new TypeError('redirect mode is set to error'));
    await expect(fetchHealth({ fetchFn: throwing })).resolves.toEqual({ state: 'unreachable' });
    await expect(fetchHealth({ fetchFn: rejecting })).resolves.toEqual({ state: 'unreachable' });
  });

  it('answers unreachable when the body cannot be read', async () => {
    const broken = {
      status: 200,
      json: () => Promise.reject(new SyntaxError('Unexpected end of JSON input')),
    } as unknown as Response;
    await expect(fetchHealth({ fetchFn: () => Promise.resolve(broken) })).resolves.toEqual({
      state: 'unreachable',
    });
  });

  it('gives up after the timeout when the request never settles, and aborts it', async () => {
    let seen: AbortSignal | undefined;
    const never = (_url: string, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    };
    const started = Date.now();
    await expect(fetchHealth({ fetchFn: never, timeoutMs: 20 })).resolves.toEqual({
      state: 'unreachable',
    });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(seen?.aborted).toBe(true);
  });

  it('gives up when the body never arrives', async () => {
    const stuck = {
      status: 200,
      json: () => new Promise<unknown>(() => undefined),
    } as unknown as Response;
    await expect(
      fetchHealth({ fetchFn: () => Promise.resolve(stuck), timeoutMs: 20 }),
    ).resolves.toEqual({ state: 'unreachable' });
  });

  it('does not time out a prompt answer, and the default timeout is a few seconds', async () => {
    await expect(
      fetchHealth({ fetchFn: () => Promise.resolve(json(200, OK_BODY)), timeoutMs: 5000 }),
    ).resolves.toEqual({ state: 'ok', shopifyApiVersion: '2026-10' });
    expect(HEALTH_TIMEOUT_MS).toBe(5000);
  });

  it('aborts the request and answers unreachable when the caller aborts', async () => {
    const controller = new AbortController();
    let seen: AbortSignal | undefined;
    const never = (_url: string, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    };
    const pending = fetchHealth({ fetchFn: never, signal: controller.signal, timeoutMs: 60_000 });
    controller.abort();
    await expect(pending).resolves.toEqual({ state: 'unreachable' });
    expect(seen?.aborted).toBe(true);
  });

  it('does not even ask when the caller has already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchFn = vi.fn(() => Promise.resolve(json(200, OK_BODY)));
    await expect(fetchHealth({ fetchFn, signal: controller.signal })).resolves.toEqual({
      state: 'unreachable',
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('uses the global fetch when none is injected', async () => {
    const globalFetch = vi.fn(() => Promise.resolve(json(200, OK_BODY)));
    vi.stubGlobal('fetch', globalFetch);
    try {
      await expect(fetchHealth()).resolves.toEqual({ state: 'ok', shopifyApiVersion: '2026-10' });
      expect(globalFetch).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
