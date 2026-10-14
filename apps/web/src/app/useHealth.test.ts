import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { INITIAL_HEALTH, resolveHealthView, useHealth } from './useHealth';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveHealthView (what a finished request does to the page state)', () => {
  it('starts in loading with no version', () => {
    expect(INITIAL_HEALTH).toEqual({ state: 'loading' });
  });

  it('adopts each of the three results while the page is still there', () => {
    expect(resolveHealthView({ state: 'ok', shopifyApiVersion: '2026-10' }, false)).toEqual({
      state: 'ok',
      shopifyApiVersion: '2026-10',
    });
    expect(resolveHealthView({ state: 'degraded' }, false)).toEqual({ state: 'degraded' });
    expect(resolveHealthView({ state: 'unreachable' }, false)).toEqual({ state: 'unreachable' });
  });

  it('ignores every result of a request that was aborted (unmount or development remount)', () => {
    // The first request of a development double-mount is aborted: its answer must not win.
    expect(resolveHealthView({ state: 'unreachable' }, true)).toBeNull();
    expect(resolveHealthView({ state: 'ok', shopifyApiVersion: '2026-10' }, true)).toBeNull();
    expect(resolveHealthView({ state: 'degraded' }, true)).toBeNull();
  });
});

describe('useHealth on the server', () => {
  function Probe() {
    const { state, shopifyApiVersion } = useHealth();
    return createElement('p', null, `${state}|${shopifyApiVersion ?? 'no-version'}`);
  }

  it('answers loading with no version on the first render', () => {
    expect(renderToString(createElement(Probe))).toBe('<p>loading|no-version</p>');
  });

  it('runs no effect on the server, so no request is made', () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('must not be called')));
    vi.stubGlobal('fetch', fetchSpy);
    renderToString(createElement(Probe));
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
