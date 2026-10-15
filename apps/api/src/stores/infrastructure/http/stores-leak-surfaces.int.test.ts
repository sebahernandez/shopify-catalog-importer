import { createServer } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RedactingLogger } from '../../../shared-kernel/logging/redacting-logger.js';
import { newStore } from '../../domain/store-rules.js';
import { PrismaService } from '../../../persistence/prisma.service.js';
import { CANARIES, canariesIn, canariesInError } from '../../test-support/canaries.js';
import { createHttpShopifyGateway } from '../gateway/http-shopify-gateway.js';
import { createShopifyGraphqlClient } from '../gateway/shopify-graphql-client.js';
import { PrismaStoreRepository } from '../persistence/prisma-store-repository.js';
import { connectionFor } from '../../test-support/gateway-test-helpers.js';
import {
  bootStoreApp,
  forbidProcessExit,
  makeSandbox,
  removeSandbox,
  shopDomainOf,
  type Reply,
  type Sandbox,
  type StoreApp,
} from '../../test-support/store-app-harness.js';

// Task 19.7 (VS10): where an error message could carry a secret. A repository whose error carries a
// canary, a real unique violation, and a fetch that fails with a canary in its URL.
const UUID = '11111111-1111-4111-8111-111111111111';
const CREDS = { kind: 'static_token', accessToken: CANARIES.staticToken } as const;
const BODY = { displayName: 'Leak', domain: 'leak', credentials: CREDS };
let sandbox: Sandbox;
let app: StoreApp | undefined;
let deadUrl = '';

/** A loopback address nothing listens on, with the canaries in its path and query. */
async function closedPortUrl(): Promise<string> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return `http://127.0.0.1:${port}/path-${CANARIES.staticToken}?token=${CANARIES.bearer}`;
}

beforeEach(async () => {
  forbidProcessExit();
  sandbox = await makeSandbox();
  deadUrl = await closedPortUrl();
});
afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.restoreAllMocks();
  await removeSandbox(sandbox);
});

const generic500 = (reply: Reply) => {
  expect(reply.status).toBe(500);
  expect(JSON.parse(reply.body)).toEqual({ statusCode: 500, message: 'Internal server error' });
  expect(reply.headers['cache-control']).toBe('no-store');
};

describe('a repository error that carries a canary', () => {
  const failing = () =>
    Object.assign(new TypeError(`could not run query with ${CANARIES.staticToken}`), {
      sql: `UPDATE ... ${CANARIES.clientSecret}`,
      cause: new Error(CANARIES.bearer),
    });

  it.each([
    ['GET api/stores/{id}', 'findById', () => ['GET', `/api/stores/${UUID}`, {}] as const],
    ['GET api/stores', 'list', () => ['GET', '/api/stores', {}] as const],
    ['POST api/stores', 'insert', () => ['POST', '/api/stores', { json: BODY }] as const],
    ['DELETE api/stores/{id}', 'delete', () => ['DELETE', `/api/stores/${UUID}`, {}] as const],
  ] as const)(
    '%s answers the generic 500 and logs only event and errorName',
    async (_name, method, request) => {
      app = await bootStoreApp(sandbox);
      vi.spyOn(PrismaStoreRepository.prototype, method).mockRejectedValue(failing());
      const [verb, path, options] = request();
      const reply = await app.send(verb, path, options);
      generic500(reply);
      expect(canariesIn(reply.body + JSON.stringify(reply.headers))).toEqual([]);
      const events = app.lines
        .map((line) => JSON.parse(line) as { message?: { event?: string } })
        .filter((entry) => entry.message?.event === 'store_request_failed');
      expect(events).toHaveLength(1);
      expect(events[0]?.message).toEqual({ event: 'store_request_failed', errorName: 'TypeError' });
      expect(canariesIn(app.lines.join('\n'))).toEqual([]);
    },
  );
});

describe('a real unique violation', () => {
  it('answers 409 through the route and leaves no canary in logs, bodies or chains', async () => {
    app = await bootStoreApp(sandbox);
    const first = await app.send('POST', '/api/stores', { json: BODY });
    const second = await app.send('POST', '/api/stores', { json: BODY });
    expect([first.status, second.status]).toEqual([201, 409]);
    for (const reply of [first, second]) {
      expect(canariesIn(reply.body + JSON.stringify(reply.headers))).toEqual([]);
    }
    expect(canariesIn(app.lines.join('\n'))).toEqual([]);
  });

  it('records what Prisma puts in its own message, which the repository never passes on', async () => {
    app = await bootStoreApp(sandbox);
    await app.send('POST', '/api/stores', { json: BODY });
    const service = new PrismaService({ dataDir: sandbox.dataDir, busyTimeoutMs: 2000 });
    await service.connect();
    try {
      const row = await service.client.store.findFirstOrThrow();
      const raw: unknown = await service.client.store
        .create({ data: { ...row, id: UUID, displayName: CANARIES.staticToken } })
        .then(
          () => undefined,
          (error: unknown) => error,
        );
      const message = raw instanceof Error ? raw.message : '';
      // VS10 observation: the unique violation names the constraint and quotes the call site
      // (a source path and the code line), not the bound parameter values.
      console.info('VS10 prisma message:', JSON.stringify(message).slice(0, 400));
      expect(raw).toBeInstanceOf(Error);
      expect(canariesIn(message)).toEqual([]);
      // The repository replaces every driver error with a fixed one anyway.
      const repository = new PrismaStoreRepository(
        service,
        { nowMs: () => 0 },
        new RedactingLogger({ sink: () => undefined }),
      );
      const duplicate = newStore(
        {
          id: UUID,
          displayName: CANARIES.staticToken,
          shopDomain: shopDomainOf('leak.myshopify.com'),
          authKind: 'static_token',
          credentialsEnvelope: `sb1.${CANARIES.clientSecret}`,
        },
        '2026-10-15T10:00:00.000Z',
      );
      const caught: unknown = await repository.insert(duplicate).then(
        () => undefined,
        (error: unknown) => error,
      );
      expect(canariesInError(caught)).toEqual([]);
    } finally {
      await service.disconnect();
    }
  });
});

describe('a failing fetch with a canary in its URL', () => {
  it('records what undici says, and the gateway error carries none of it', async () => {
    const undiciFailure: unknown = await fetch(deadUrl, {
      method: 'POST',
      headers: { 'x-shopify-access-token': CANARIES.shopifyShaped },
    }).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(undiciFailure).toBeInstanceOf(TypeError);
    // VS10 observation: the message is the fixed text `fetch failed`; the cause names the system
    // error and the host and port, not the URL path, the query, the headers or the body.
    console.info('VS10 undici:', (undiciFailure as Error).message, (undiciFailure as Error).cause);
    expect(canariesInError(undiciFailure)).toEqual([]);

    const gateway = createHttpShopifyGateway(
      createShopifyGraphqlClient({
        fetchFn: (_url, init) => fetch(deadUrl, init),
        sleep: () => Promise.resolve(),
      }),
    );
    const error: unknown = await gateway
      .getShopInfo(connectionFor('leak.myshopify.com', CANARIES.shopifyShaped))
      .then(
        () => undefined,
        (failure: unknown) => failure,
      );
    expect(error).toMatchObject({ kind: 'NETWORK' });
    expect((error as Error).cause).toBeUndefined();
    expect(canariesInError(error)).toEqual([]);
  });

  it('leaves no canary in logs or bodies when verify runs over that fetch', async () => {
    app = await bootStoreApp(sandbox, {
      overrides: {
        fetchFn: (_url, init) => fetch(deadUrl, init),
        sleep: () => Promise.resolve(),
      },
    });
    const created = await app.send('POST', '/api/stores', { json: BODY });
    const { id } = JSON.parse(created.body) as { id: string };
    const verified = await app.send('POST', `/api/stores/${id}/verify`);
    expect(verified.status).toBe(200);
    expect(JSON.parse(verified.body)).toMatchObject({ ok: false });
    expect(canariesIn(verified.body + app.lines.join('\n'))).toEqual([]);
  });
});
