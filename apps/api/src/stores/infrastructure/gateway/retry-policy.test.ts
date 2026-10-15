import type { ShopifyErrorKind } from '@importer/contracts';
import { describe, expect, it } from 'vitest';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import { withRetry } from './retry-policy.js';

const run = async (
  kinds: Array<ShopifyErrorKind | { kind: 'THROTTLED'; retryAfterMs: number } | 'ok'>,
  options: { retry?: 'safe' | 'none' | undefined; random?: number } = {},
) => {
  const waits: number[] = [];
  let requests = 0;
  const outcome = await withRetry(
    () => {
      const step = kinds[Math.min(requests++, kinds.length - 1)];
      if (step === 'ok') return Promise.resolve('done');
      const error =
        typeof step === 'string'
          ? new ShopifyGatewayError(step)
          : new ShopifyGatewayError(step?.kind ?? 'THROTTLED', {
              retryAfterMs: step?.retryAfterMs ?? 0,
            });
      return Promise.reject(error);
    },
    {
      retry: 'retry' in options ? options.retry : 'safe',
      sleep: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
      random: () => options.random ?? 0.5,
    },
  ).then(
    (value) => ({ value }),
    (error: unknown) => ({ error: error as ShopifyGatewayError }),
  );
  return { outcome, waits, requests };
};

describe('withRetry', () => {
  it('backs off with jitter: THROTTLED twice then success waits 500 and 1000', async () => {
    const result = await run(['THROTTLED', 'THROTTLED', 'ok']);
    expect(result.requests).toBe(3);
    expect(result.waits).toEqual([500, 1000]);
    expect(result.outcome).toEqual({ value: 'done' });
  });

  it('stops after 3 attempts and throws the last error unchanged', async () => {
    const result = await run(['SERVER_ERROR']);
    expect(result.requests).toBe(3);
    expect('error' in result.outcome && result.outcome.error.kind).toBe('SERVER_ERROR');
  });

  it('raises the wait to retryAfterMs but never shortens the backoff', async () => {
    const raised = await run([{ kind: 'THROTTLED', retryAfterMs: 5000 }, 'ok'], { random: 0 });
    expect(raised.waits).toEqual([5000]);
    const kept = await run([{ kind: 'THROTTLED', retryAfterMs: 100 }, 'ok'], { random: 0.9 });
    expect(kept.waits).toEqual([900]);
  });

  it('retries NETWORK then TIMEOUT and succeeds on attempt 3', async () => {
    const result = await run(['NETWORK', 'TIMEOUT', 'ok']);
    expect(result.requests).toBe(3);
    expect(result.outcome).toEqual({ value: 'done' });
  });

  it.each([
    'SCOPE_MISSING',
    'QUERY_TOO_COSTLY',
    'SHOP_UNAVAILABLE',
    'STORE_NOT_FOUND',
    'AUTH_FAILED',
    'VERSION_UNSUPPORTED',
    'INVALID_RESPONSE',
    'GRAPHQL_ERROR',
    'CREDENTIAL_EXCHANGE_FAILED',
  ] as const)('sends one request for %s', async (kind) => {
    expect((await run([kind])).requests).toBe(1);
  });

  it('sends one request when the retry mode is none or absent', async () => {
    expect((await run(['THROTTLED'], { retry: 'none' })).requests).toBe(1);
    expect((await run(['SERVER_ERROR'], { retry: undefined })).requests).toBe(1);
  });
});
