import { describe, expect, it } from 'vitest';
import { scriptedFetch } from './scripted-fetch.js';

const text = (value: string): Uint8Array => new TextEncoder().encode(value);

describe('scriptedFetch', () => {
  it('serves responses in order and records every call', async () => {
    const script = scriptedFetch([
      { status: 200, headers: { 'content-type': 'application/json' }, body: '{"a":1}' },
      { status: 503, body: 'down' },
    ]);
    const first = await script.fetch('https://a.example/x', {
      method: 'POST',
      headers: { 'X-Test': '1' },
      body: 'payload',
      redirect: 'error',
    });
    const second = await script.fetch('https://b.example/y', { method: 'POST' });
    expect(first.status).toBe(200);
    expect(first.headers.get('content-type')).toBe('application/json');
    expect(await first.text()).toBe('{"a":1}');
    expect(second.status).toBe(503);
    expect(script.calls).toHaveLength(2);
    expect(script.calls[0]).toMatchObject({
      url: 'https://a.example/x',
      method: 'POST',
      headers: { 'x-test': '1' },
      body: 'payload',
    });
    expect(script.calls[0]?.init.redirect).toBe('error');
    expect(script.calls[1]?.url).toBe('https://b.example/y');
  });

  it('never resolves a never step until the signal aborts', async () => {
    const script = scriptedFetch([{ never: true }]);
    const controller = new AbortController();
    const pending = script.fetch('https://a.example/', { signal: controller.signal });
    let settled = false;
    pending.catch(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    controller.abort(new DOMException('stop', 'TimeoutError'));
    await expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
  });

  it('rejects a throws step with the given error', async () => {
    const boom = new TypeError('fetch failed');
    const script = scriptedFetch([{ throws: boom }]);
    await expect(script.fetch('https://a.example/', {})).rejects.toBe(boom);
  });

  it('streams chunks and records pulled bytes and cancellation', async () => {
    const script = scriptedFetch([{ chunks: [text('abc'), text('def'), text('ghi')] }]);
    const response = await script.fetch('https://a.example/', {});
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    expect((await reader.read()).value).toEqual(text('abc'));
    await reader.cancel();
    expect(script.calls[0]?.cancelled).toBe(true);
    expect(script.calls[0]?.pulledBytes).toBeLessThan(9);
  });

  it('aborts mid-body: the stream errors with the signal reason after the hang point', async () => {
    const script = scriptedFetch([{ chunks: [text('abc'), text('def')], hangAfter: 1 }]);
    const controller = new AbortController();
    const response = await script.fetch('https://a.example/', { signal: controller.signal });
    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    expect((await reader.read()).value).toEqual(text('abc'));
    const next = reader.read();
    controller.abort(new DOMException('stop', 'AbortError'));
    await expect(next).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('fails the test when called past the end of the script', async () => {
    const script = scriptedFetch([]);
    await expect(script.fetch('https://a.example/', {})).rejects.toThrow(/past the end/);
  });
});
