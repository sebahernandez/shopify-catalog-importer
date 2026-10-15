import { describe, expect, it } from 'vitest';
import type { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import type { TransportBody, TransportResponse } from './shopify-http-transport.js';
import { classifyResponse } from './classify-response.js';

const json = (value: unknown): TransportBody => ({ kind: 'json', value });
const flagged = (reason: 'OVERSIZE' | 'NOT_JSON' | 'UNPARSEABLE'): TransportBody => ({
  kind: 'flagged',
  reason,
});
const response = (
  status: number,
  body: TransportBody,
  headers: Record<string, string> = {},
): TransportResponse => ({ status, headers: new Headers(headers), body });
const errorOf = (input: TransportResponse): ShopifyGatewayError => {
  const result = classifyResponse(input);
  if (result.ok) throw new Error('expected a classified failure');
  return result.error;
};

describe('classifyResponse by HTTP status', () => {
  it.each([
    [401, 'AUTH_FAILED'],
    [402, 'SHOP_UNAVAILABLE'],
    [403, 'SHOP_UNAVAILABLE'],
    [423, 'SHOP_UNAVAILABLE'],
    [404, 'STORE_NOT_FOUND'],
    [429, 'THROTTLED'],
    [500, 'SERVER_ERROR'],
    [503, 'SERVER_ERROR'],
  ])('maps %i to %s', (status, kind) => {
    expect(errorOf(response(status, json({}))).kind).toBe(kind);
  });

  it('turns an integer Retry-After into retryAfterMs and ignores bad values', () => {
    expect(errorOf(response(429, json({}), { 'retry-after': '2' })).retryAfterMs).toBe(2000);
    for (const value of ['-1', '1.5', 'abc', '']) {
      expect(
        errorOf(response(429, json({}), { 'retry-after': value })).retryAfterMs,
      ).toBeUndefined();
    }
    expect(errorOf(response(429, json({}))).retryAfterMs).toBeUndefined();
  });

  it('maps an unlisted status to GRAPHQL_ERROR only for JSON with non-empty errors', () => {
    expect(errorOf(response(400, json({ errors: [{ message: 'x' }] }))).kind).toBe('GRAPHQL_ERROR');
    expect(errorOf(response(400, json({ errors: [] }))).kind).toBe('INVALID_RESPONSE');
    expect(errorOf(response(418, flagged('NOT_JSON'))).kind).toBe('INVALID_RESPONSE');
  });

  it('keeps the status kind when the body is flagged', () => {
    expect(errorOf(response(503, flagged('NOT_JSON'))).kind).toBe('SERVER_ERROR');
    expect(errorOf(response(401, flagged('NOT_JSON'))).kind).toBe('AUTH_FAILED');
  });

  it.each([
    ['wrong content type', flagged('NOT_JSON')],
    ['oversize', flagged('OVERSIZE')],
    ['bad JSON', flagged('UNPARSEABLE')],
    ['a non-object', json([1])],
    ['a string', json('x')],
    ['null (empty body)', json(null)],
    ['neither data nor errors', json({ extensions: {} })],
  ])('maps a 2xx with %s to INVALID_RESPONSE', (_name, body) => {
    expect(errorOf(response(200, body)).kind).toBe('INVALID_RESPONSE');
  });

  it('returns the data of a clean 2xx', () => {
    expect(classifyResponse(response(200, json({ data: { a: 1 } })))).toEqual({
      ok: true,
      data: { a: 1 },
    });
    expect(classifyResponse(response(200, json({ data: 1, errors: [] }))).ok).toBe(true);
  });

  it('never holds any part of the body', () => {
    const canary = 'CANARY-BODY-TEXT';
    for (const status of [400, 401, 429, 500]) {
      const error = errorOf(response(status, json({ errors: [{ message: canary }] })));
      expect(JSON.stringify(error) + error.message + String(error.cause)).not.toContain(canary);
    }
  });
});
