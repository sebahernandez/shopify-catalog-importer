import { describe, expect, it, vi } from 'vitest';
import { request, type Parser } from './request';
import { INVALID_REPORT } from '../test-fixtures';

const text: Parser<string> = {
  safeParse: (value) =>
    typeof value === 'string' ? { success: true, data: value } : { success: false },
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const spec = { method: 'GET', path: '/api/x', reply: { as: 'json', parser: text } } as const;

describe('request', () => {
  it('sends a same-origin, credential-free, uncached call and returns the parsed body', async () => {
    const fetchFn = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
      Promise.resolve(json(200, 'hola')),
    );
    const result = await request(
      { fetchFn },
      { ...spec, method: 'POST', headers: { 'content-type': 'x' }, body: 'b' },
    );
    expect(result).toEqual({ ok: true, data: 'hola' });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe('/api/x');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      headers: { 'content-type': 'x' },
      body: 'b',
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('fails closed when a success body does not match the contract', async () => {
    const result = await request({ fetchFn: () => Promise.resolve(json(200, 42)) }, spec);
    expect(result).toEqual({ ok: false, failure: { kind: 'invalid_response', status: 200 } });
  });

  it('fails closed when a success body is not JSON', async () => {
    const result = await request(
      { fetchFn: () => Promise.resolve(new Response('<html>', { status: 200 })) },
      spec,
    );
    expect(result).toEqual({ ok: false, failure: { kind: 'network' } });
  });

  it('reads a blob and an empty answer', async () => {
    const blob = await request(
      { fetchFn: () => Promise.resolve(new Response('abc', { status: 200 })) },
      { method: 'GET', path: '/f', reply: { as: 'blob' } },
    );
    expect(blob.ok && blob.data instanceof Blob).toBe(true);
    const empty = await request(
      { fetchFn: () => Promise.resolve(new Response(null, { status: 204 })) },
      { method: 'DELETE', path: '/f', reply: { as: 'empty' } },
    );
    expect(empty.ok).toBe(true);
  });

  it('turns an ApiError answer into its code and status', async () => {
    const body = { error: { code: 'STORE_NOT_CONNECTED', message: 'm' } };
    const result = await request({ fetchFn: () => Promise.resolve(json(409, body)) }, spec);
    expect(result).toEqual({
      ok: false,
      failure: { kind: 'api', status: 409, code: 'STORE_NOT_CONNECTED', report: null },
    });
  });

  it('carries the validation report of a 422 WORKBOOK_INVALID answer', async () => {
    const body = { error: { code: 'WORKBOOK_INVALID', message: 'm' }, report: INVALID_REPORT };
    const result = await request({ fetchFn: () => Promise.resolve(json(422, body)) }, spec);
    expect(result).toEqual({
      ok: false,
      failure: { kind: 'api', status: 422, code: 'WORKBOOK_INVALID', report: INVALID_REPORT },
    });
  });

  it.each([
    ['an unknown code', json(400, { error: { code: 'NOPE', message: 'm' } })],
    ['the framework 500 body', json(500, { statusCode: 500, message: 'Internal server error' })],
    ['an HTML proxy page', new Response('<html>Bad gateway</html>', { status: 502 })],
    ['an empty body', new Response(null, { status: 500 })],
  ])('keeps the status but no code for %s', async (_name, response) => {
    const result = await request({ fetchFn: () => Promise.resolve(response) }, spec);
    expect(result).toEqual({
      ok: false,
      failure: { kind: 'api', status: response.status, code: null, report: null },
    });
  });

  it('answers network when fetch throws or rejects', async () => {
    const throwing = () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(request({ fetchFn: throwing }, spec)).resolves.toEqual({
      ok: false,
      failure: { kind: 'network' },
    });
    await expect(
      request({ fetchFn: () => Promise.reject(new TypeError('x')) }, spec),
    ).resolves.toEqual({ ok: false, failure: { kind: 'network' } });
  });

  it('answers timeout and aborts the call when it never settles', async () => {
    let seen: AbortSignal | undefined;
    const never = (_url: string, init: RequestInit) => {
      seen = init.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    };
    await expect(request({ fetchFn: never, timeoutMs: 20 }, spec)).resolves.toEqual({
      ok: false,
      failure: { kind: 'timeout' },
    });
    expect(seen?.aborted).toBe(true);
  });

  it('answers aborted when the caller aborts, and never calls fetch if already aborted', async () => {
    const controller = new AbortController();
    const never = () => new Promise<Response>(() => undefined);
    const pending = request({ fetchFn: never, signal: controller.signal, timeoutMs: 60_000 }, spec);
    controller.abort();
    await expect(pending).resolves.toEqual({ ok: false, failure: { kind: 'aborted' } });

    const fetchFn = vi.fn(() => Promise.resolve(json(200, 'x')));
    await expect(request({ fetchFn, signal: controller.signal }, spec)).resolves.toEqual({
      ok: false,
      failure: { kind: 'aborted' },
    });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('uses the global fetch when none is injected', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(json(200, 'g'))),
    );
    try {
      await expect(request({}, spec)).resolves.toEqual({ ok: true, data: 'g' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
