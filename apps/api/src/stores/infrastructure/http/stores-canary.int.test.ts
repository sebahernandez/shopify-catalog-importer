import { existsSync, readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { StoreSummary, StoreVerification, type ShopifyErrorKind } from '@importer/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SecretBoxError } from '../../../shared-kernel/secret-box/secret-box-error.js';
import { createClientCredentialsExchanger } from '../credentials/client-credentials-exchanger.js';
import { createHttpShopifyGateway } from '../gateway/http-shopify-gateway.js';
import { createShopifyGraphqlClient } from '../gateway/shopify-graphql-client.js';
import { createShopifyHttpTransport } from '../gateway/shopify-http-transport.js';
import { isDeclaredStoreLogField } from '../store-log-fields.js';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import {
  CANARIES,
  canariesIn,
  canariesInBytes,
  canariesInError,
} from '../../test-support/canaries.js';
import { fullScopesBody } from '../../test-support/fixtures/granted-scopes.js';
import { threeActiveBody } from '../../test-support/fixtures/locations.js';
import { healthyShopBody } from '../../test-support/fixtures/shop-info.js';
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

// Task 19.5: the canary suite. Five distinct secret-looking values are seeded through create,
// verify (success and every gateway failure kind, with scripted bodies that echo them), replace and
// delete on the real application. Nothing may find them afterwards: not in the logger sink, any
// response body or header, any thrown error (message, properties, cause chain), nor in the
// database file and its WAL.
type Answer =
  { status: number; headers?: Record<string, string>; body: string } | { throws: Error };
const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Answer => ({
  status,
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const html = (text: string, status = 200): Answer => ({
  status,
  headers: { 'content-type': 'text/html' },
  body: `<html>${text}</html>`,
});
const gqlError = (code: string, message: string) => ({
  errors: [{ message, extensions: { code } }],
});
const tokenOk = json({ access_token: CANARIES.exchangedToken, expires_in: 86399 });

interface Script {
  shop: Answer;
  scopes: Answer;
  locations: Answer;
  token: Answer;
}
const HEALTHY: Script = {
  shop: json(healthyShopBody),
  scopes: json(fullScopesBody),
  locations: json(threeActiveBody),
  token: tokenOk,
};

let script: Script = HEALTHY;
let outbound = 0;
const routedFetch = (url: string, init: RequestInit): Promise<Response> => {
  outbound += 1;
  const body = typeof init.body === 'string' ? init.body : '';
  const answer = url.includes('/oauth/access_token')
    ? script.token
    : body.includes('currentAppInstallation')
      ? script.scopes
      : body.includes('locations(')
        ? script.locations
        : script.shop;
  if ('throws' in answer) return Promise.reject(answer.throws);
  return Promise.resolve(
    new Response(answer.body, { status: answer.status, headers: answer.headers ?? {} }),
  );
};

interface Scenario {
  name: string;
  store: 'alpha' | 'beta';
  kind: ShopifyErrorKind;
  script: Partial<Script>;
}
const echo = (a: string, b: string) => `echo ${a} and ${b}`;
const SCENARIOS: Scenario[] = [
  {
    name: 'invalid key echoed',
    store: 'alpha',
    kind: 'AUTH_FAILED',
    script: { shop: json({ errors: echo(CANARIES.staticToken, CANARIES.bearer) }, 401) },
  },
  {
    name: 'access denied echoed',
    store: 'alpha',
    kind: 'SCOPE_MISSING',
    script: {
      scopes: json(gqlError('ACCESS_DENIED', echo(CANARIES.bearer, CANARIES.staticToken))),
    },
  },
  {
    name: 'throttled echoed',
    store: 'alpha',
    kind: 'THROTTLED',
    script: { shop: json({ message: CANARIES.shopifyShaped }, 429, { 'retry-after': '1' }) },
  },
  {
    name: 'server error echoed',
    store: 'alpha',
    kind: 'SERVER_ERROR',
    script: { shop: html(echo(CANARIES.staticToken, CANARIES.shopifyShaped), 503) },
  },
  {
    name: 'html on 200',
    store: 'alpha',
    kind: 'INVALID_RESPONSE',
    script: { shop: html(CANARIES.bearer) },
  },
  {
    name: 'wrong shape echoed',
    store: 'alpha',
    kind: 'INVALID_RESPONSE',
    script: { shop: json({ data: { shop: { id: CANARIES.staticToken } } }) },
  },
  {
    name: 'graphql error echoed',
    store: 'alpha',
    kind: 'GRAPHQL_ERROR',
    script: { shop: json(gqlError('WEIRD', echo(CANARIES.staticToken, CANARIES.clientSecret))) },
  },
  {
    name: 'query too costly echoed',
    store: 'alpha',
    kind: 'QUERY_TOO_COSTLY',
    script: { shop: json(gqlError('MAX_COST_EXCEEDED', CANARIES.shopifyShaped)) },
  },
  {
    name: 'forbidden echoed',
    store: 'alpha',
    kind: 'SHOP_UNAVAILABLE',
    script: { shop: json({ errors: CANARIES.bearer }, 403) },
  },
  {
    name: 'not found echoed',
    store: 'alpha',
    kind: 'STORE_NOT_FOUND',
    script: { shop: json({ errors: CANARIES.staticToken }, 404) },
  },
  {
    name: 'network failure naming the token in its URL',
    store: 'alpha',
    kind: 'NETWORK',
    script: {
      shop: {
        throws: new TypeError(`fetch failed https://x.example/?token=${CANARIES.staticToken}`),
      },
    },
  },
  {
    name: 'timeout carrying a canary',
    store: 'alpha',
    kind: 'TIMEOUT',
    script: { shop: { throws: new DOMException(CANARIES.bearer, 'TimeoutError') } },
  },
  {
    name: 'version served by fall-forward',
    store: 'alpha',
    kind: 'VERSION_UNSUPPORTED',
    script: { shop: json(healthyShopBody, 200, { 'x-shopify-api-version': '2099-01' }) },
  },
  {
    name: 'token endpoint echoing the client secret',
    store: 'beta',
    kind: 'CREDENTIAL_EXCHANGE_FAILED',
    script: {
      token: json({ error: 'invalid_client', error_description: CANARIES.clientSecret }, 400),
    },
  },
  {
    name: 'token endpoint shop_not_permitted echoing the client secret',
    store: 'beta',
    kind: 'CREDENTIAL_EXCHANGE_FAILED',
    script: { token: json({ error: 'shop_not_permitted', detail: CANARIES.clientSecret }, 403) },
  },
  {
    name: 'token endpoint server error',
    store: 'beta',
    kind: 'SERVER_ERROR',
    script: { token: html(echo(CANARIES.clientSecret, CANARIES.exchangedToken), 502) },
  },
  {
    name: 'exchanged token rejected and echoed',
    store: 'beta',
    kind: 'AUTH_FAILED',
    script: { shop: json({ errors: echo(CANARIES.exchangedToken, CANARIES.clientSecret) }, 401) },
  },
];

const replies: Reply[] = [];
const observed = new Set<string>();
const thrown: unknown[] = [];
let sandbox: Sandbox;
let app: StoreApp;
let ids: { alpha: string; beta: string; gamma: string };
let envelopeBeta = '';

const call: StoreApp['send'] = async (method, path, options) => {
  const reply = await app.send(method, path, options);
  replies.push(reply);
  return reply;
};
const parse = <T>(reply: Reply): T => JSON.parse(reply.body) as T;
const create = async (displayName: string, domain: string, credentials: unknown) => {
  const reply = await call('POST', '/api/stores', { json: { displayName, domain, credentials } });
  expect(reply.status).toBe(201);
  return StoreSummary.parse(parse(reply)).id;
};
const verify = async (id: string) => {
  const reply = await call('POST', `/api/stores/${id}/verify`);
  expect(reply.status).toBe(200);
  return StoreVerification.parse(parse(reply));
};

function rawTables(): Record<string, unknown[]> {
  const db = new Database(app.databasePath, { readonly: true });
  try {
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    return Object.fromEntries(
      names.map(({ name }) => [name, db.prepare(`SELECT * FROM "${name}"`).all()]),
    );
  } finally {
    db.close();
  }
}
const fileBytes = (): Uint8Array[] =>
  [app.databasePath, `${app.databasePath}-wal`, `${app.databasePath}-shm`]
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path));

function swapEnvelopes(a: string, b: string): void {
  const db = new Database(app.databasePath);
  try {
    const read = db.prepare('SELECT credentials_envelope AS e FROM store WHERE id = ?');
    const first = (read.get(a) as { e: string }).e;
    const second = (read.get(b) as { e: string }).e;
    const write = db.prepare('UPDATE store SET credentials_envelope = ? WHERE id = ?');
    write.run(second, a);
    write.run(first, b);
  } finally {
    db.close();
  }
}

beforeAll(async () => {
  forbidProcessExit();
  sandbox = await makeSandbox();
  app = await bootStoreApp(sandbox, {
    overrides: { fetchFn: routedFetch, sleep: () => Promise.resolve() },
  });
  const staticCredentials = { kind: 'static_token', accessToken: CANARIES.staticToken };
  const clientCredentials = {
    kind: 'client_credentials',
    clientId: 'client-id-visible-in-no-log',
    clientSecret: CANARIES.clientSecret,
  };
  ids = {
    alpha: await create('Canary Display Alpha', 'alpha', staticCredentials),
    beta: await create('Canary Display Beta', 'beta.myshopify.com', clientCredentials),
    gamma: await create('Canary Display Gamma', 'gamma', {
      kind: 'static_token',
      accessToken: CANARIES.bearer,
    }),
  };
  envelopeBeta = (rawTables()['store'] as { id: string; credentials_envelope: string }[]).find(
    (row) => row.id === ids.beta,
  )!.credentials_envelope;

  // Requests rejected by validation, with canaries in the body.
  await call('POST', '/api/stores', {
    json: {
      displayName: 'reject-marker-5d1',
      domain: 'evil.example',
      credentials: { kind: 'static_token', accessToken: CANARIES.shopifyShaped },
    },
  });
  await call('POST', '/api/stores', { body: `{"reject-marker-5d1": "${CANARIES.bearer}"` });
  await call('POST', '/api/stores', {
    json: {
      displayName: 'Canary Display Alpha',
      domain: 'alpha.myshopify.com',
      credentials: staticCredentials,
    },
  });

  script = HEALTHY;
  for (const id of [ids.alpha, ids.beta, ids.gamma]) expect((await verify(id)).ok).toBe(true);

  for (const scenario of SCENARIOS) {
    script = { ...HEALTHY, ...scenario.script };
    // Replacing the credentials drops the cached token, so the exchange runs again.
    if (scenario.store === 'beta') {
      const reset = await call('PUT', `/api/stores/${ids.beta}/credentials`, {
        json: { credentials: clientCredentials },
      });
      expect(reset.status).toBe(200);
    }
    const result = await verify(ids[scenario.store]);
    expect(result.ok, scenario.name).toBe(false);
    expect(
      result.problems.map((problem) => problem.kind),
      scenario.name,
    ).toContain(scenario.kind);
    for (const problem of result.problems) observed.add(problem.kind);
  }
  script = HEALTHY;

  // Replace alpha's credentials with another canary, verify again with it echoed, then delete.
  await call('PUT', `/api/stores/${ids.alpha}/credentials`, {
    json: { credentials: { kind: 'static_token', accessToken: CANARIES.shopifyShaped } },
  });
  script = { ...HEALTHY, shop: json({ errors: CANARIES.shopifyShaped }, 401) };
  await verify(ids.alpha);
  script = HEALTHY;
}, 120_000);

afterAll(async () => {
  await app.close().catch(() => undefined);
  await removeSandbox(sandbox);
  vi.restoreAllMocks();
});

describe('the flows', () => {
  it('exercised every one of the 13 gateway failure kinds', () => {
    expect([...observed].sort()).toEqual(
      [
        'AUTH_FAILED',
        'CREDENTIAL_EXCHANGE_FAILED',
        'GRAPHQL_ERROR',
        'INVALID_RESPONSE',
        'NETWORK',
        'QUERY_TOO_COSTLY',
        'SCOPE_MISSING',
        'SERVER_ERROR',
        'SHOP_UNAVAILABLE',
        'STORE_NOT_FOUND',
        'THROTTLED',
        'TIMEOUT',
        'VERSION_UNSUPPORTED',
      ].sort(),
    );
  });

  it('really carried the canaries to the application (the scripted bodies were read)', () => {
    expect(outbound).toBeGreaterThan(40);
    expect(replies.length).toBeGreaterThan(25);
  });
});

describe('thrown errors', () => {
  it('carry no canary in message, properties or cause chain, on every echoing body', async () => {
    const transport = createShopifyHttpTransport({ fetchFn: routedFetch });
    const exchanger = createClientCredentialsExchanger({ transport, now: () => 0 });
    const gateway = createHttpShopifyGateway(
      createShopifyGraphqlClient({
        fetchFn: routedFetch,
        sleep: () => Promise.resolve(),
        random: () => 0,
      }),
    );
    for (const scenario of SCENARIOS) {
      script = { ...HEALTHY, ...scenario.script };
      const connection = connectionFor('alpha.myshopify.com', CANARIES.staticToken);
      for (const read of [
        () => gateway.getShopInfo(connection),
        () => gateway.getGrantedScopes(connection),
        () => gateway.listLocations(connection),
        () =>
          exchanger.exchange({
            domain: shopDomainOf('beta.myshopify.com'),
            clientId: 'client-id',
            clientSecret: CANARIES.clientSecret,
          }),
      ]) {
        const error: unknown = await read().then(
          () => undefined,
          (failure: unknown) => failure,
        );
        if (error === undefined) continue;
        thrown.push(error);
        expect(error, scenario.name).toBeInstanceOf(ShopifyGatewayError);
        expect((error as Error).cause).toBeUndefined();
      }
    }
    script = HEALTHY;
    expect(thrown.length).toBeGreaterThan(10);
    for (const error of thrown) expect(canariesInError(error)).toEqual([]);
  }, 60_000);
});

describe('no canary anywhere', () => {
  it('in the logger output', () => {
    expect(app.lines.length).toBeGreaterThan(5);
    expect(canariesIn(app.lines.join('\n'))).toEqual([]);
  });

  it('in any response body or header', () => {
    for (const reply of replies) {
      expect(canariesIn(reply.body)).toEqual([]);
      expect(canariesIn(JSON.stringify(reply.headers))).toEqual([]);
    }
  });

  it('in the database file and its WAL while the application runs', () => {
    const files = fileBytes();
    expect(files.length).toBeGreaterThanOrEqual(1);
    for (const bytes of files) expect(canariesInBytes(bytes)).toEqual([]);
  });

  it('in any column of any table, and every envelope starts with sb1.', () => {
    const tables = rawTables();
    for (const [name, rows] of Object.entries(tables)) {
      for (const row of rows) {
        const text = JSON.stringify(row, (_key, value: unknown) =>
          Buffer.isBuffer(value) ? value.toString('latin1') : value,
        );
        expect(canariesIn(text), name).toEqual([]);
      }
    }
    const stores = tables['store'] as { credentials_envelope: string }[];
    expect(stores).toHaveLength(3);
    for (const row of stores) expect(row.credentials_envelope.startsWith('sb1.')).toBe(true);
  });
});

describe('request bodies and log fields', () => {
  it('logs no part of an accepted or a rejected request body', () => {
    const output = app.lines.join('\n');
    for (const part of [
      'Canary Display',
      'client-id-visible-in-no-log',
      'reject-marker-5d1',
      'evil.example',
    ]) {
      expect(output).not.toContain(part);
    }
  });

  it('logs only declared field names', () => {
    for (const line of app.lines) {
      const entry = JSON.parse(line) as { message?: unknown };
      if (typeof entry.message === 'object' && entry.message !== null) {
        for (const name of Object.keys(entry.message)) {
          expect(isDeclaredStoreLogField(name) || name === 'message', name).toBe(true);
        }
      }
    }
  });
});

describe('envelopes', () => {
  it('swapped envelopes read as unreadable, with zero outbound calls', async () => {
    swapEnvelopes(ids.alpha, ids.gamma);
    try {
      const before = outbound;
      const result = await verify(ids.alpha);
      expect(result.problems.map((problem) => problem.code)).toEqual(['CREDENTIALS_UNREADABLE']);
      expect(result.problems[0]?.kind).toBe('AUTH_FAILED');
      expect(outbound).toBe(before);
    } finally {
      swapEnvelopes(ids.alpha, ids.gamma);
    }
  });

  it('an envelope under another store context fails with DECRYPT_FAILED', () => {
    const rows = rawTables()['store'] as { id: string; credentials_envelope: string }[];
    const alpha = rows.find((row) => row.id === ids.alpha)!;
    const error = (() => {
      try {
        app.box.decrypt(alpha.credentials_envelope, `store:${ids.beta}:credentials`);
        return undefined;
      } catch (failure) {
        return failure;
      }
    })();
    expect(error).toBeInstanceOf(SecretBoxError);
    expect(error).toMatchObject({ code: 'DECRYPT_FAILED' });
    expect(canariesInError(error)).toEqual([]);
  });

  it('is gone after the store is deleted, and delete leaks nothing', async () => {
    expect(canariesInBytes(Buffer.concat(fileBytes()))).toEqual([]);
    for (const id of [ids.alpha, ids.beta, ids.gamma]) {
      const reply = await call('DELETE', `/api/stores/${id}`);
      expect(reply.status).toBe(204);
    }
    expect(rawTables()['store']).toEqual([]);
    expect(envelopeBeta.startsWith('sb1.')).toBe(true);
    expect(canariesInBytes(Buffer.concat(fileBytes()))).toEqual([]);
    for (const reply of replies) expect(canariesIn(reply.body)).toEqual([]);
  });

  it('leaves no canary in the files after the application stops', async () => {
    await app.close();
    for (const bytes of fileBytes()) expect(canariesInBytes(bytes)).toEqual([]);
  });
});
