import { describe, expect, it } from 'vitest';
import type { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import { classifyResponse } from './classify-response.js';

const entry = (code?: string, message = 'm') => ({
  message,
  ...(code !== undefined && { extensions: { code } }),
});
const classify = (...errors: unknown[]): ShopifyGatewayError => {
  const result = classifyResponse({
    status: 200,
    headers: new Headers(),
    body: { kind: 'json', value: { data: { shop: { id: 'leak' } }, errors } },
  });
  if (result.ok) throw new Error('expected a classified failure');
  return result.error;
};

describe('classifyResponse errors inside a 200', () => {
  it.each([
    ['THROTTLED', entry('THROTTLED'), 'THROTTLED'],
    [
      'invalid key message',
      entry(undefined, 'Invalid API key or access token (unrecognized login or wrong password)'),
      'AUTH_FAILED',
    ],
    ['ACCESS_DENIED without requiredAccess', entry('ACCESS_DENIED'), 'SCOPE_MISSING'],
    ['SHOP_INACTIVE', entry('SHOP_INACTIVE'), 'SHOP_UNAVAILABLE'],
    [
      'MAX_COST_EXCEEDED',
      entry(
        'MAX_COST_EXCEEDED',
        'Query cost is 2003, which exceeds the single query max cost limit (1000)',
      ),
      'QUERY_TOO_COSTLY',
    ],
    ['INTERNAL_SERVER_ERROR', entry('INTERNAL_SERVER_ERROR'), 'SERVER_ERROR'],
    ['an unknown code', entry('SOMETHING_NEW'), 'GRAPHQL_ERROR'],
    ['a malformed entry', 'not-an-object', 'GRAPHQL_ERROR'],
  ])('maps %s to %s', (_name, input, kind) => {
    expect(classify(input).kind).toBe(kind);
  });

  it('applies the precedence across all entries', () => {
    expect(classify(entry('ACCESS_DENIED'), entry('THROTTLED')).kind).toBe('THROTTLED');
    expect(classify(entry('SHOP_INACTIVE'), entry('ACCESS_DENIED')).kind).toBe('SCOPE_MISSING');
  });

  it('uses no data when errors is non-empty', () => {
    const error = classify(entry('SOMETHING_NEW'));
    expect(JSON.stringify(error)).not.toContain('leak');
  });

  it('gives identical messages for one kind from different bodies', () => {
    expect(classify(entry('ACCESS_DENIED', 'one')).message).toBe(
      classify(entry('ACCESS_DENIED', 'two')).message,
    );
  });
});
