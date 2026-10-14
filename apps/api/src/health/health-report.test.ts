import { HealthResponse } from '@importer/contracts';
import { describe, expect, it } from 'vitest';
import { reportHealth } from './health-report.js';

describe('reportHealth', () => {
  it('answers 200 and ok when the database is reachable', async () => {
    const reply = await reportHealth(() => Promise.resolve(true), '2031-07');
    expect(reply).toEqual({
      statusCode: 200,
      body: { status: 'ok', database: 'up', shopifyApiVersion: '2031-07' },
    });
  });

  it('answers 503 and degraded when the database is not reachable', async () => {
    const reply = await reportHealth(() => Promise.resolve(false), '2031-07');
    expect(reply).toEqual({
      statusCode: 503,
      body: { status: 'degraded', database: 'down', shopifyApiVersion: '2031-07' },
    });
  });

  it('reads the version from its argument, not from a constant', async () => {
    const first = await reportHealth(() => Promise.resolve(true), '2031-07');
    const second = await reportHealth(() => Promise.resolve(true), '2044-01');
    expect(first.body.shopifyApiVersion).toBe('2031-07');
    expect(second.body.shopifyApiVersion).toBe('2044-01');
  });

  it('treats a check that rejects as database down, with no error text anywhere', async () => {
    const reply = await reportHealth(
      () => Promise.reject(new Error('disk exploded at /secret/place')),
      '2031-07',
    );
    expect(reply.statusCode).toBe(503);
    expect(reply.body).toEqual({
      status: 'degraded',
      database: 'down',
      shopifyApiVersion: '2031-07',
    });
    expect(JSON.stringify(reply)).not.toMatch(/exploded|secret|place/);
  });

  it('treats a check that throws before returning a promise as database down', async () => {
    const reply = await reportHealth(() => {
      throw new Error('sync failure');
    }, '2031-07');
    expect(reply.statusCode).toBe(503);
    expect(reply.body.database).toBe('down');
  });

  it('treats a value that is not exactly true as database down', async () => {
    const odd = (() => Promise.resolve('yes')) as unknown as () => Promise<boolean>;
    expect((await reportHealth(odd, '2031-07')).statusCode).toBe(503);
  });

  it('produces bodies the shared schema accepts, for both outcomes', async () => {
    for (const reachable of [true, false]) {
      const reply = await reportHealth(() => Promise.resolve(reachable), '2031-07');
      expect(HealthResponse.strict().parse(reply.body)).toEqual(reply.body);
    }
  });
});
