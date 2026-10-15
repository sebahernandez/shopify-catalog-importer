import 'reflect-metadata';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Controller, Module, Post, UseFilters, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  bootStoreApp,
  forbidProcessExit,
  makeSandbox,
  removeSandbox,
  type Sandbox,
  type StoreApp,
} from '../../test-support/store-app-harness.js';
import { StoresExceptionFilter } from './stores-exception.filter.js';

// VS9 (design D21). Finding: with Nest's default body parser, a malformed JSON body fails inside
// the parser middleware, before routing. The error never reaches a controller-scoped filter and
// the framework answers 400 with a message that quotes the JSON parser's complaint. So the
// fallback of D21 (task 18.4) is needed: `bodyParser: false` plus a bounded reader for the store
// routes. The first test pins the finding on a stock application; the others pin the outcome.
const CANARY = 'canary-body-parse-7f3c91';
const MALFORMED = `{"displayName":"${CANARY}",`;
let sandbox: Sandbox;
let app: StoreApp | undefined;
let stock: INestApplication | undefined;

beforeEach(async () => {
  forbidProcessExit();
  sandbox = await makeSandbox();
});
afterEach(async () => {
  await app?.close();
  await stock?.close();
  app = undefined;
  stock = undefined;
  vi.restoreAllMocks();
  await removeSandbox(sandbox);
});

describe('VS9: the stock framework parser', () => {
  it('does not route a parser error to a controller filter and answers its own message', async () => {
    const seen: unknown[] = [];
    @Controller('probe')
    @UseFilters({ catch: (error: unknown) => void seen.push(error) })
    class ProbeController {
      @Post()
      post(): string {
        return 'ok';
      }
    }
    @Module({ controllers: [ProbeController] })
    class ProbeModule {}
    stock = await NestFactory.create(ProbeModule, { logger: false });
    await stock.listen(0, '127.0.0.1');
    const { port } = (stock.getHttpServer() as Server).address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}/probe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: MALFORMED,
    });
    expect(response.status).toBe(400);
    expect(seen).toEqual([]);
    expect(await response.text()).toMatch(/JSON/);
  });
});

describe('malformed JSON on POST api/stores in the real application', () => {
  it('answers 400 STORE_REQUEST_INVALID through the filter, with no parser message', async () => {
    const filterCalls = vi.spyOn(StoresExceptionFilter.prototype, 'catch');
    app = await bootStoreApp(sandbox);
    const reply = await app.send('POST', '/api/stores', { body: MALFORMED });
    expect(reply.status).toBe(400);
    expect(JSON.parse(reply.body)).toEqual({
      error: { code: 'STORE_REQUEST_INVALID', message: 'The request is not valid.' },
    });
    expect(reply.headers['cache-control']).toBe('no-store');
    expect(filterCalls).toHaveBeenCalledTimes(1);
    expect(reply.body).not.toMatch(/JSON|position|Unexpected|Expected/);
  });

  it('logs no body text on the rejected request', async () => {
    app = await bootStoreApp(sandbox);
    await app.send('POST', '/api/stores', { body: MALFORMED });
    expect(app.lines.join('\n')).not.toContain(CANARY);
    expect(app.lines.join('\n')).not.toContain('displayName');
  });

  it('rejects a body over 16 KB and a non-JSON body the same way', async () => {
    app = await bootStoreApp(sandbox);
    const big = await app.send('POST', '/api/stores', {
      json: { displayName: 'x'.repeat(20_000) },
    });
    const text = await app.send('POST', '/api/stores', {
      body: 'plain',
      headers: { 'content-type': 'text/plain' },
    });
    for (const reply of [big, text]) {
      expect(reply.status).toBe(400);
      expect((JSON.parse(reply.body) as { error: { code: string } }).error.code).toBe(
        'STORE_REQUEST_INVALID',
      );
    }
  });
});
