import { describe, expect, it, vi } from 'vitest';
import { STORE_ID, storeSummary, verification } from '../test-fixtures';
import { createStore, listStores, replaceCredentials, verifyStore } from './stores-client';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function fake(response: Response) {
  return vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
    Promise.resolve(response),
  );
}

describe('stores client', () => {
  it('lists stores from the { stores } envelope', async () => {
    const fetchFn = fake(json(200, { stores: [storeSummary()] }));
    await expect(listStores({ fetchFn })).resolves.toEqual({ ok: true, data: [storeSummary()] });
    expect(fetchFn.mock.calls[0]?.[0]).toBe('/api/stores');
    expect(fetchFn.mock.calls[0]?.[1].method).toBe('GET');
  });

  it.each([
    ['a missing envelope', [storeSummary()]],
    ['a non-array stores field', { stores: 'x' }],
    ['one broken entry', { stores: [storeSummary(), { id: 'nope' }] }],
    [
      'a summary with a secret-looking extra field',
      { stores: [{ ...storeSummary(), accessToken: 'shpat_x' }] },
    ],
  ])('rejects a list with %s', async (_name, body) => {
    const result = await listStores({ fetchFn: fake(json(200, body)) });
    expect(result).toEqual({ ok: false, failure: { kind: 'invalid_response', status: 200 } });
  });

  it('creates a store with a JSON body', async () => {
    const fetchFn = fake(json(201, storeSummary()));
    const body = {
      displayName: 'Mi tienda',
      domain: 'mi-tienda.myshopify.com',
      credentials: { kind: 'static_token', accessToken: 'shpat_12345678' },
    } as const;
    await expect(createStore(body, { fetchFn })).resolves.toEqual({
      ok: true,
      data: storeSummary(),
    });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe('/api/stores');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'content-type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual(body);
  });

  it('maps a duplicate domain to its code', async () => {
    const result = await createStore(
      {
        displayName: 'a',
        domain: 'a.myshopify.com',
        credentials: { kind: 'static_token', accessToken: '12345678' },
      },
      { fetchFn: fake(json(409, { error: { code: 'STORE_ALREADY_EXISTS', message: 'm' } })) },
    );
    expect(result).toMatchObject({ ok: false, failure: { code: 'STORE_ALREADY_EXISTS' } });
  });

  it('verifies with POST on the store path and a long timeout', async () => {
    const fetchFn = fake(json(200, verification()));
    await expect(verifyStore(STORE_ID, { fetchFn })).resolves.toMatchObject({ ok: true });
    expect(fetchFn.mock.calls[0]?.[0]).toBe(`/api/stores/${STORE_ID}/verify`);
    expect(fetchFn.mock.calls[0]?.[1].method).toBe('POST');
  });

  it('reports a verification whose ok flag contradicts its problems as invalid', async () => {
    const bad = verification({ ok: false, problems: [] });
    const result = await verifyStore(STORE_ID, { fetchFn: fake(json(200, bad)) });
    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid_response' } });
  });

  it('encodes the id and replaces credentials with PUT', async () => {
    const fetchFn = fake(json(200, storeSummary()));
    const credentials = { kind: 'static_token', accessToken: 'shpat_87654321' } as const;
    await replaceCredentials('a/b', credentials, { fetchFn });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe('/api/stores/a%2Fb/credentials');
    expect(init?.method).toBe('PUT');
    expect(JSON.parse(init?.body as string)).toEqual({ credentials });
  });

  it('answers network when the API cannot be reached', async () => {
    const fetchFn = () => Promise.reject(new TypeError('Failed to fetch'));
    await expect(listStores({ fetchFn })).resolves.toEqual({
      ok: false,
      failure: { kind: 'network' },
    });
  });
});
