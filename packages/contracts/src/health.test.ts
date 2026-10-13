import { describe, expect, it } from 'vitest';
import { HealthResponse } from './health.js';

describe('HealthResponse', () => {
  it('accepts a healthy body', () => {
    const body = { status: 'ok', database: 'up', shopifyApiVersion: '2026-10' };
    expect(HealthResponse.parse(body)).toEqual(body);
  });

  it('accepts a degraded body', () => {
    const body = { status: 'degraded', database: 'down', shopifyApiVersion: '2026-10' };
    expect(HealthResponse.safeParse(body).success).toBe(true);
  });

  it.each([
    ['unknown status', { status: 'fine', database: 'up', shopifyApiVersion: '2026-10' }],
    [
      'unknown database state',
      { status: 'ok', database: 'sideways', shopifyApiVersion: '2026-10' },
    ],
    ['missing version', { status: 'ok', database: 'up' }],
    ['non-string version', { status: 'ok', database: 'up', shopifyApiVersion: 202610 }],
    ['not an object', 'ok'],
  ])('rejects %s', (_label, body) => {
    expect(HealthResponse.safeParse(body).success).toBe(false);
  });
});
