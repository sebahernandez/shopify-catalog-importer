import { ShopifyErrorKind, isRetryableKind } from '@importer/contracts';
import { describe, expect, it } from 'vitest';
import { ShopifyGatewayError } from './shopify-gateway-error.js';

const KINDS = ShopifyErrorKind.options;

describe('ShopifyGatewayError', () => {
  it.each(KINDS)('builds a safe error for %s', (kind) => {
    const error = new ShopifyGatewayError(kind);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ShopifyGatewayError');
    expect(error.kind).toBe(kind);
    expect(error.message.length).toBeGreaterThan(0);
    expect(error.retryable).toBe(isRetryableKind(kind));
  });

  it('is retryable for exactly THROTTLED, SERVER_ERROR, NETWORK and TIMEOUT', () => {
    const retryable = KINDS.filter((kind) => new ShopifyGatewayError(kind).retryable);
    expect(retryable).toEqual(['THROTTLED', 'SERVER_ERROR', 'NETWORK', 'TIMEOUT']);
  });

  it('keeps retryAfterMs when given and leaves it undefined otherwise', () => {
    expect(new ShopifyGatewayError('THROTTLED', { retryAfterMs: 2000 }).retryAfterMs).toBe(2000);
    expect(new ShopifyGatewayError('THROTTLED').retryAfterMs).toBeUndefined();
  });

  it('keeps a reason only for CREDENTIAL_EXCHANGE_FAILED', () => {
    const error = new ShopifyGatewayError('CREDENTIAL_EXCHANGE_FAILED', {
      reason: 'SHOP_NOT_PERMITTED',
    });
    expect(error.reason).toBe('SHOP_NOT_PERMITTED');
    expect(new ShopifyGatewayError('CREDENTIAL_EXCHANGE_FAILED').reason).toBeUndefined();
    expect(() => new ShopifyGatewayError('AUTH_FAILED', { reason: 'UNKNOWN' })).toThrow(TypeError);
  });

  it('uses one fixed message per kind whatever produced the failure', () => {
    const a = new ShopifyGatewayError('GRAPHQL_ERROR');
    const b = new ShopifyGatewayError('GRAPHQL_ERROR');
    expect(a.message).toBe(b.message);
    expect(new Set(KINDS.map((kind) => new ShopifyGatewayError(kind).message)).size).toBe(
      KINDS.length,
    );
  });

  it('stores no cause, body, headers or URL', () => {
    const canary = 'canary-token-123';
    const path = '/admin/api/2026-10/graphql.json';
    const error = new ShopifyGatewayError('SERVER_ERROR', { retryAfterMs: 5 });
    expect(Object.keys(error).sort()).toEqual(['kind', 'name', 'retryAfterMs', 'retryable']);
    expect('cause' in error).toBe(false);
    const dump = JSON.stringify(error) + error.message + (error.stack ?? '').split('\n')[0];
    expect(dump).not.toContain(canary);
    expect(dump).not.toContain(path);
  });

  it('accepts no original error: extra arguments are not part of the signature', () => {
    // @ts-expect-error the constructor takes only a kind and optional details
    const error = new ShopifyGatewayError('NETWORK', {}, new Error('original'));
    expect('cause' in error).toBe(false);
  });
});
