import Database from 'better-sqlite3';
import { StoreSummary, StoreVerification } from '@importer/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateStoreUseCase } from '../../application/create-store.use-case.js';
import { DeleteStoreUseCase } from '../../application/delete-store.use-case.js';
import { ReplaceCredentialsUseCase } from '../../application/replace-credentials.use-case.js';
import { VerifyStoreConnectionUseCase } from '../../application/verify-store-connection.use-case.js';
import { PrismaStoreRepository } from '../persistence/prisma-store-repository.js';
import {
  ALLOWED_ORIGIN,
  bootStoreApp,
  forbidProcessExit,
  makeSandbox,
  removeSandbox,
  shopDomainOf,
  type Reply,
  type Sandbox,
  type StoreApp,
} from '../../test-support/store-app-harness.js';
import { ALL_SCOPES } from '../../test-support/store-use-case-harness.js';

// Task 18.2: the store routes over real HTTP, on the real application, a migrated sandbox database,
// the simulator gateway and a `DeferredSecretBox` bound at boot over a generated key.
const TOKEN = 'static-token-canary-int-0001';
const CREDS = { kind: 'static_token', accessToken: TOKEN } as const;
const BODY = { displayName: 'Demo', domain: 'demo', credentials: CREDS };
const UNKNOWN = '99999999-9999-4999-8999-999999999999';
const SHOP = {
  name: 'Demo shop',
  currencyCode: 'USD',
  planName: 'Basic',
  shopifyPlus: false,
  partnerDevelopment: false,
  scopes: ALL_SCOPES,
  locations: [
    {
      id: 'gid://shopify/Location/1',
      name: 'Warehouse-Alpha',
      isActive: true,
      fulfillsOnlineOrders: true,
    },
    {
      id: 'gid://shopify/Location/2',
      name: 'Warehouse-Beta',
      isActive: true,
      fulfillsOnlineOrders: false,
    },
  ],
};

let sandbox: Sandbox;
let app: StoreApp;

interface Body {
  error: { code: string };
  stores: unknown[];
}
const json = (reply: Reply): Body => JSON.parse(reply.body) as Body;
const noStore = (reply: Reply) => expect(reply.headers['cache-control']).toBe('no-store');

function rows(): unknown[] {
  const db = new Database(app.databasePath, { readonly: true });
  try {
    return db.prepare('SELECT * FROM store ORDER BY id').all();
  } finally {
    db.close();
  }
}

async function create(overrides: Record<string, unknown> = {}): Promise<StoreSummary> {
  const reply = await app.send('POST', '/api/stores', { json: { ...BODY, ...overrides } });
  expect(reply.status).toBe(201);
  return StoreSummary.parse(json(reply));
}

beforeEach(async () => {
  forbidProcessExit();
  sandbox = await makeSandbox();
  app = await bootStoreApp(sandbox);
  app.simulator.addShop(shopDomainOf('demo.myshopify.com'), SHOP);
});
afterEach(async () => {
  await app.close();
  vi.restoreAllMocks();
  await removeSandbox(sandbox);
});

describe('happy paths', () => {
  it('creates with 201 and lists one', async () => {
    const reply = await app.send('POST', '/api/stores', { json: BODY });
    expect(reply.status).toBe(201);
    noStore(reply);
    const created = StoreSummary.parse(json(reply));
    expect(created).toMatchObject({
      status: 'UNVERIFIED',
      shopDomain: 'demo.myshopify.com',
      hasCredentials: true,
    });
    const list = await app.send('GET', '/api/stores');
    expect(list.status).toBe(200);
    noStore(list);
    expect(json(list).stores).toHaveLength(1);
    expect(reply.body + list.body).not.toContain(TOKEN);
    expect(reply.body + list.body).not.toContain('sb1.');
  });

  it('verifies a healthy store: 200 ok, then the store reads CONNECTED with a count only', async () => {
    const { id } = await create();
    const reply = await app.send('POST', `/api/stores/${id}/verify`);
    expect(reply.status).toBe(200);
    noStore(reply);
    expect(StoreVerification.parse(json(reply)).ok).toBe(true);
    const read = await app.send('GET', `/api/stores/${id}`);
    const store = StoreSummary.parse(json(read));
    expect(store.status).toBe('CONNECTED');
    expect(store.lastVerification?.locationCount).toBe(2);
    expect(read.body).not.toContain('Warehouse');
    expect(app.simulator.calls).toEqual(['getShopInfo', 'getGrantedScopes', 'listLocations']);
  });

  it('answers 200 ok false with AUTH_FAILED when the simulator rejects the credentials', async () => {
    const { id } = await create();
    app.simulator.faults.always('getShopInfo', { kind: 'AUTH_FAILED' });
    const reply = await app.send('POST', `/api/stores/${id}/verify`);
    expect(reply.status).toBe(200);
    const result = StoreVerification.parse(json(reply));
    expect(result.ok).toBe(false);
    expect(result.problems.map((problem) => problem.code)).toEqual(['AUTH_FAILED']);
    expect(StoreSummary.parse(json(await app.send('GET', `/api/stores/${id}`))).status).toBe(
      'AUTH_FAILED',
    );
  });

  it('deletes with 204, an empty body and no-store, then reads 404', async () => {
    const { id } = await create();
    const reply = await app.send('DELETE', `/api/stores/${id}`);
    expect(reply.status).toBe(204);
    expect(reply.body).toBe('');
    noStore(reply);
    const after = await app.send('GET', `/api/stores/${id}`);
    expect(after.status).toBe(404);
    expect(rows()).toEqual([]);
  });

  it('replaces credentials: 200 and UNVERIFIED after a verified state', async () => {
    const { id } = await create();
    await app.send('POST', `/api/stores/${id}/verify`);
    const reply = await app.send('PUT', `/api/stores/${id}/credentials`, {
      json: { credentials: { kind: 'static_token', accessToken: 'another-token-canary-0002' } },
    });
    expect(reply.status).toBe(200);
    noStore(reply);
    const summary = StoreSummary.parse(json(reply));
    expect(summary).toMatchObject({ status: 'UNVERIFIED', lastVerifiedAt: null });
    expect(reply.body).not.toContain('another-token-canary-0002');
  });
});

describe('request validation', () => {
  it('rejects an offending domain with STORE_DOMAIN_INVALID and stores nothing', async () => {
    const reply = await app.send('POST', '/api/stores', {
      json: { ...BODY, domain: 'myshopify.com.evil.example' },
    });
    expect(reply.status).toBe(400);
    expect(json(reply).error.code).toBe('STORE_DOMAIN_INVALID');
    noStore(reply);
    expect(rows()).toEqual([]);
    expect(reply.body).not.toContain('evil');
  });

  it('rejects a 7 character token', async () => {
    const reply = await app.send('POST', '/api/stores', {
      json: { ...BODY, credentials: { kind: 'static_token', accessToken: '1234567' } },
    });
    expect(reply.status).toBe(400);
    expect(json(reply).error.code).toBe('STORE_CREDENTIALS_INVALID');
    expect(reply.body).not.toContain('1234567');
  });

  it.each([
    ['malformed JSON', { body: '{"displayName": ' }],
    ['an extra field', { json: { ...BODY, extra: true } }],
    ['an 81 character name', { json: { ...BODY, displayName: 'n'.repeat(81) } }],
  ])('rejects %s with STORE_REQUEST_INVALID', async (_label, options) => {
    const reply = await app.send('POST', '/api/stores', options);
    expect(reply.status).toBe(400);
    expect(json(reply).error.code).toBe('STORE_REQUEST_INVALID');
    noStore(reply);
    expect(rows()).toEqual([]);
  });

  it('reports the domain when domain and credentials are both invalid', async () => {
    const reply = await app.send('POST', '/api/stores', {
      json: {
        ...BODY,
        domain: 'bad.example',
        credentials: { kind: 'static_token', accessToken: 'x' },
      },
    });
    expect(json(reply).error.code).toBe('STORE_DOMAIN_INVALID');
  });

  it('answers 409 for a duplicate canonical domain', async () => {
    await create({ domain: 'demo.myshopify.com' });
    const reply = await app.send('POST', '/api/stores', { json: BODY });
    expect(reply.status).toBe(409);
    expect(json(reply).error.code).toBe('STORE_ALREADY_EXISTS');
    noStore(reply);
    expect(rows()).toHaveLength(1);
  });
});

describe('unknown stores', () => {
  const routes = (id: string): [string, string, object?][] => [
    ['GET', `/api/stores/${id}`],
    ['POST', `/api/stores/${id}/verify`],
    ['PUT', `/api/stores/${id}/credentials`, { json: { credentials: CREDS } }],
    ['DELETE', `/api/stores/${id}`],
  ];

  it('answers 404 STORE_NOT_FOUND on all four id routes with no gateway call', async () => {
    for (const [method, path, options] of routes(UNKNOWN)) {
      const reply = await app.send(method, path, options);
      expect(reply.status, path).toBe(404);
      expect(json(reply).error.code).toBe('STORE_NOT_FOUND');
      noStore(reply);
    }
    expect(app.simulator.calls).toEqual([]);
  });

  it('answers a malformed id with a byte-identical response', async () => {
    const known = routes(UNKNOWN);
    const malformed = routes('not-a-uuid');
    for (const [index, [method, path, options]] of malformed.entries()) {
      const [, knownPath, knownOptions] = known[index]!;
      const first = await app.send(method, path, options);
      const second = await app.send(method, knownPath, knownOptions);
      expect(first.status).toBe(second.status);
      expect(first.body).toBe(second.body);
    }
    expect(app.simulator.calls).toEqual([]);
  });
});

describe('origin guard on the write routes', () => {
  const EVIL = { origin: 'https://evil.example' };

  it('answers 403 ORIGIN_NOT_ALLOWED on all four with no handler, repository or gateway call', async () => {
    const { id } = await create();
    const before = rows();
    const handlers = [
      vi.spyOn(CreateStoreUseCase.prototype, 'execute'),
      vi.spyOn(VerifyStoreConnectionUseCase.prototype, 'execute'),
      vi.spyOn(ReplaceCredentialsUseCase.prototype, 'execute'),
      vi.spyOn(DeleteStoreUseCase.prototype, 'execute'),
    ];
    const repository = vi.spyOn(PrismaStoreRepository.prototype, 'findById');
    const writes = [
      vi.spyOn(PrismaStoreRepository.prototype, 'insert'),
      vi.spyOn(PrismaStoreRepository.prototype, 'delete'),
      vi.spyOn(PrismaStoreRepository.prototype, 'replaceCredentials'),
    ];
    const attempts: [string, string, object][] = [
      ['POST', '/api/stores', { json: BODY, headers: EVIL }],
      ['POST', `/api/stores/${id}/verify`, { headers: EVIL }],
      ['PUT', `/api/stores/${id}/credentials`, { json: { credentials: CREDS }, headers: EVIL }],
      ['DELETE', `/api/stores/${id}`, { headers: EVIL }],
    ];
    for (const [method, path, options] of attempts) {
      const reply = await app.send(method, path, options);
      expect(reply.status, path).toBe(403);
      expect(json(reply).error.code).toBe('ORIGIN_NOT_ALLOWED');
      noStore(reply);
    }
    for (const spy of [...handlers, repository, ...writes]) expect(spy).not.toHaveBeenCalled();
    expect(app.simulator.calls).toEqual([]);
    expect(rows()).toEqual(before);
  });

  it('refuses a cross-site request without Origin on verify', async () => {
    const { id } = await create();
    const reply = await app.send('POST', `/api/stores/${id}/verify`, {
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    expect(reply.status).toBe(403);
    expect(app.simulator.calls).toEqual([]);
  });

  it('processes an allow-listed origin', async () => {
    const reply = await app.send('POST', '/api/stores', {
      json: BODY,
      headers: { origin: ALLOWED_ORIGIN },
    });
    expect(reply.status).toBe(201);
  });
});

describe('GET routes', () => {
  it('call no gateway and no SecretBox, and leave the row byte-identical', async () => {
    const { id } = await create();
    const before = rows();
    const encrypt = vi.spyOn(app.box, 'encrypt');
    const decrypt = vi.spyOn(app.box, 'decrypt');
    app.simulator.calls.length = 0;
    expect((await app.send('GET', '/api/stores')).status).toBe(200);
    expect((await app.send('GET', `/api/stores/${id}`)).status).toBe(200);
    expect(app.simulator.calls).toEqual([]);
    expect(encrypt).not.toHaveBeenCalled();
    expect(decrypt).not.toHaveBeenCalled();
    expect(rows()).toEqual(before);
  });

  it('answer a foreign Origin with 200 and no canary or envelope', async () => {
    await create();
    const reply = await app.send('GET', '/api/stores', {
      headers: { origin: 'https://evil.example' },
    });
    expect(reply.status).toBe(200);
    expect(reply.body).not.toContain(TOKEN);
    expect(reply.body).not.toContain('sb1.');
  });

  it('refuse a disallowed Host with 403 HOST_NOT_ALLOWED and no-store', async () => {
    const reply = await app.send('GET', '/api/stores', { host: 'evil.example' });
    expect(reply.status).toBe(403);
    expect(json(reply).error.code).toBe('HOST_NOT_ALLOWED');
    noStore(reply);
  });
});
