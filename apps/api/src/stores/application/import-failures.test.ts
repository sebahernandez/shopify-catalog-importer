import { describe, expect, it } from 'vitest';
import { ShopifyErrorKind } from '@importer/contracts';
import { ShopifyGatewayError } from '../ports/shopify-gateway-error.js';
import { failureOfError, failureOfRejection } from './import-failures.js';

describe('failureOfRejection', () => {
  it('names a taken handle', () => {
    const result = failureOfRejection([{ field: ['input', 'handle'], code: 'TAKEN' }]);
    expect(result.code).toBe('HANDLE_TAKEN');
    expect(result.details).toEqual([{ field: 'input.handle', code: 'TAKEN' }]);
  });

  it('uses the general code for any other rejection', () => {
    expect(failureOfRejection([{ field: ['input', 'title'], code: 'BLANK' }]).code).toBe(
      'SHOPIFY_REJECTED',
    );
    expect(failureOfRejection([{ field: ['input', 'title'], code: 'TAKEN' }]).code).toBe(
      'SHOPIFY_REJECTED',
    );
  });

  it('drops a field path or a code that is not a plain identifier', () => {
    const result = failureOfRejection([
      { field: ['input', 'value with spaces and a secret'], code: 'has a space' },
      { field: ['a'.repeat(65)], code: 'x'.repeat(65) },
      { field: null, code: null },
    ]);
    expect(result.details).toEqual([
      { field: null, code: null },
      { field: null, code: null },
      { field: null, code: null },
    ]);
  });

  it('keeps at most 20 details', () => {
    const errors = Array.from({ length: 50 }, () => ({ field: ['input'], code: 'X' }));
    expect(failureOfRejection(errors).details).toHaveLength(20);
  });
});

describe('failureOfError', () => {
  it.each(ShopifyErrorKind.options)('classifies %s', (kind) => {
    const { failure, stop } = failureOfError(new ShopifyGatewayError(kind));
    expect(failure.message.length).toBeGreaterThan(0);
    const continues = kind === 'GRAPHQL_ERROR' || kind === 'QUERY_TOO_COSTLY';
    expect(stop).toBe(!continues);
  });

  it.each([
    ['NETWORK', 'OUTCOME_UNKNOWN'],
    ['TIMEOUT', 'OUTCOME_UNKNOWN'],
    ['SERVER_ERROR', 'OUTCOME_UNKNOWN'],
    ['INVALID_RESPONSE', 'OUTCOME_UNKNOWN'],
    ['THROTTLED', 'THROTTLED'],
    ['AUTH_FAILED', 'STORE_ACCESS_FAILED'],
    ['SCOPE_MISSING', 'STORE_ACCESS_FAILED'],
    ['GRAPHQL_ERROR', 'SHOPIFY_ERROR'],
  ] as const)('maps %s to %s', (kind, code) => {
    expect(failureOfError(new ShopifyGatewayError(kind)).failure.code).toBe(code);
  });

  it('treats an unknown error as an unknown outcome and never describes it', () => {
    const { failure, stop } = failureOfError(new Error('boom shpat_SECRET_VALUE_1234'));
    expect(stop).toBe(true);
    expect(failure.code).toBe('OUTCOME_UNKNOWN');
    expect(JSON.stringify(failure)).not.toContain('SECRET');
  });
});
