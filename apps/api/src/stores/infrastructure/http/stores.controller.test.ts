import 'reflect-metadata';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiError } from '@importer/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { CreateStoreUseCase } from '../../application/create-store.use-case.js';
import { DeleteStoreUseCase } from '../../application/delete-store.use-case.js';
import { GetStoreUseCase } from '../../application/get-store.use-case.js';
import { ListStoresUseCase } from '../../application/list-stores.use-case.js';
import { ReplaceCredentialsUseCase } from '../../application/replace-credentials.use-case.js';
import {
  ShopifyRequestFailedError,
  StoreCredentialsInvalidError,
  StoreDisplayNameInvalidError,
  StoreDomainInvalidError,
  StoreNotConnectedError,
  WorkbookInvalidError,
} from '../../application/store-errors.js';
import { ImportCatalogUseCase } from '../../application/import-catalog.use-case.js';
import { STORES_LOGGER } from '../../application/stores.tokens.js';
import { VerifyStoreConnectionUseCase } from '../../application/verify-store-connection.use-case.js';
import { WORKBOOK_LIMITS } from '../../../catalog-workbook/application/catalog-workbook.tokens.js';
import { withLimits } from '../../../catalog-workbook/domain/workbook-limits.js';
import { parseShopDomain } from '../../domain/shop-domain.js';
import { StoresController } from './stores.controller.js';
import { StoresExceptionFilter } from './stores-exception.filter.js';

const ID = '11111111-1111-4111-8111-111111111111';
const SUMMARY = { id: ID, displayName: 'Demo' };
const VERIFICATION = { ok: false, problems: [{ code: 'AUTH_FAILED' }] };
const GOOD = {
  displayName: 'Demo',
  domain: 'demo',
  credentials: { kind: 'static_token', accessToken: 'static-token-ctrl-0001' },
};

const calls: { name: string; args: unknown[] }[] = [];
const logged: unknown[] = [];
const record = (name: string, result: unknown) => ({
  execute: (...args: unknown[]) => {
    calls.push({ name, args });
    return Promise.resolve(result);
  },
});

/** Mirrors the real order in the use case: name, domain, credentials. */
const createFake = {
  execute: (body: { displayName: string; domain: string; credentials: unknown }) => {
    calls.push({ name: 'create', args: [body] });
    if ([...body.displayName.trim()].length > 80) throw new StoreDisplayNameInvalidError();
    const domain = parseShopDomain(body.domain);
    if (!domain.ok) throw new StoreDomainInvalidError(domain.reason);
    const credentials = body.credentials as { accessToken?: unknown };
    if (typeof credentials.accessToken !== 'string' || credentials.accessToken.length < 8) {
      throw new StoreCredentialsInvalidError();
    }
    return Promise.resolve(SUMMARY);
  },
};

/** What the next import call does; the tests set it before sending. */
let importBehaviour: (id: string, bytes: Uint8Array, sha256: string) => Promise<unknown> = () =>
  Promise.resolve(IMPORTED);
const IMPORTED = {
  totals: { products: 0, created: 0, failed: 0 },
  stoppedEarly: false,
  results: [],
};
const importFake = {
  execute: (id: string, bytes: Uint8Array, sha256: string) => {
    calls.push({ name: 'import', args: [id, bytes.byteLength, sha256] });
    return importBehaviour(id, bytes, sha256);
  },
};

let app: INestApplication | undefined;

async function boot(): Promise<string> {
  @Module({
    controllers: [StoresController],
    providers: [
      StoresExceptionFilter,
      { provide: STORES_LOGGER, useValue: { error: (entry: unknown) => void logged.push(entry) } },
      { provide: CreateStoreUseCase, useValue: createFake },
      { provide: ListStoresUseCase, useValue: record('list', [SUMMARY]) },
      { provide: GetStoreUseCase, useValue: record('get', SUMMARY) },
      { provide: VerifyStoreConnectionUseCase, useValue: record('verify', VERIFICATION) },
      { provide: ReplaceCredentialsUseCase, useValue: record('replace', SUMMARY) },
      { provide: DeleteStoreUseCase, useValue: record('delete', undefined) },
      { provide: ImportCatalogUseCase, useValue: importFake },
      { provide: WORKBOOK_LIMITS, useValue: withLimits({ maxUploadBytes: 64 }) },
    ],
  })
  class TestModule {}
  app = await NestFactory.create(TestModule, { logger: false, bodyParser: false });
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
  return `http://127.0.0.1:${port}/api/stores`;
}

afterEach(async () => {
  calls.length = 0;
  logged.length = 0;
  importBehaviour = () => Promise.resolve(IMPORTED);
  await app?.close();
  app = undefined;
});

const json = (value: unknown): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value),
});
const codeOf = async (response: Response) => ApiError.parse(await response.json()).error.code;

describe('routes and statuses', () => {
  it('POST creates with 201 and the summary', async () => {
    const response = await fetch(await boot(), json(GOOD));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(SUMMARY);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('lists with 200 as { stores }', async () => {
    const response = await fetch(await boot());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ stores: [SUMMARY] });
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('gets one with 200', async () => {
    const response = await fetch(`${await boot()}/${ID}`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(SUMMARY);
  });

  it('verify answers 200 with the result also when ok is false, taking no body', async () => {
    const response = await fetch(`${await boot()}/${ID}/verify`, { method: 'POST' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(VERIFICATION);
    expect(calls).toEqual([{ name: 'verify', args: [ID] }]);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('PUT credentials answers 200', async () => {
    const response = await fetch(`${await boot()}/${ID}/credentials`, {
      ...json({ credentials: GOOD.credentials }),
      method: 'PUT',
    });
    expect(response.status).toBe(200);
    expect(calls[0]?.name).toBe('replace');
  });

  it('DELETE answers 204 with an empty body and no-store', async () => {
    const response = await fetch(`${await boot()}/${ID}`, { method: 'DELETE' });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});

describe('request validation', () => {
  it.each([
    ['an extra field', { ...GOOD, extra: 1 }],
    ['an id field', { ...GOOD, id: ID }],
    ['a wrong type', { ...GOOD, displayName: 5 }],
    ['a missing member', { displayName: 'Demo', domain: 'demo' }],
    ['credentials that are not an object', { ...GOOD, credentials: 'x' }],
    ['an 81 character name', { ...GOOD, displayName: 'n'.repeat(81) }],
  ])('rejects %s with STORE_REQUEST_INVALID', async (_label, body) => {
    const response = await fetch(await boot(), json(body));
    expect(response.status).toBe(400);
    expect(await codeOf(response)).toBe('STORE_REQUEST_INVALID');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects an array body and a missing body', async () => {
    const url = await boot();
    expect(await codeOf(await fetch(url, json([GOOD])))).toBe('STORE_REQUEST_INVALID');
    expect(await codeOf(await fetch(url, { method: 'POST' }))).toBe('STORE_REQUEST_INVALID');
  });

  it('rejects an unknown member on the replace body', async () => {
    const response = await fetch(`${await boot()}/${ID}/credentials`, {
      ...json({ credentials: GOOD.credentials, displayName: 'x' }),
      method: 'PUT',
    });
    expect(await codeOf(response)).toBe('STORE_REQUEST_INVALID');
    expect(calls).toEqual([]);
  });

  it('rejects an offending domain', async () => {
    const response = await fetch(
      await boot(),
      json({ ...GOOD, domain: 'myshopify.com.evil.example' }),
    );
    expect(response.status).toBe(400);
    expect(await codeOf(response)).toBe('STORE_DOMAIN_INVALID');
  });

  it('rejects a 7 character access token', async () => {
    const response = await fetch(
      await boot(),
      json({ ...GOOD, credentials: { kind: 'static_token', accessToken: '1234567' } }),
    );
    expect(response.status).toBe(400);
    expect(await codeOf(response)).toBe('STORE_CREDENTIALS_INVALID');
  });

  it('reports the domain when both domain and credentials are invalid', async () => {
    const response = await fetch(
      await boot(),
      json({ ...GOOD, domain: 'bad.example', credentials: { kind: 'x' } }),
    );
    expect(await codeOf(response)).toBe('STORE_DOMAIN_INVALID');
  });

  it('answers malformed JSON with STORE_REQUEST_INVALID, reaching no use case', async () => {
    const response = await fetch(await boot(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"displayName": "canary-json-5e1"',
    });
    expect(response.status).toBe(400);
    expect(await codeOf(response)).toBe('STORE_REQUEST_INVALID');
    expect(calls).toEqual([]);
  });

  it('never returns or logs schema issues', async () => {
    const response = await fetch(await boot(), json({ ...GOOD, displayName: 5 }));
    const text = await response.text();
    expect(text).not.toMatch(/issues|expected|invalid_type|zod/i);
    expect(logged).toEqual([]);
  });
});

describe('ids', () => {
  it('answers a malformed id like an unknown one before any use case call', async () => {
    const url = await boot();
    const attempts = [
      fetch(`${url}/not-a-uuid`),
      fetch(`${url}/not-a-uuid/verify`, { method: 'POST' }),
      fetch(`${url}/not-a-uuid/credentials`, {
        ...json({ credentials: GOOD.credentials }),
        method: 'PUT',
      }),
      fetch(`${url}/not-a-uuid`, { method: 'DELETE' }),
    ];
    for (const response of await Promise.all(attempts)) {
      expect(response.status).toBe(404);
      expect(await codeOf(response)).toBe('STORE_NOT_FOUND');
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
    expect(calls).toEqual([]);
  });
});

describe('POST :id/import', () => {
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const upload = (body: Uint8Array | string, type: string | undefined = XLSX): RequestInit => ({
    method: 'POST',
    ...(type !== undefined && { headers: { 'content-type': type } }),
    body,
  });

  it('answers 200 with the use case result, no-store, and hands over the bytes and their hash', async () => {
    const response = await fetch(`${await boot()}/${ID}/import`, upload('workbook-bytes'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(IMPORTED);
    expect(calls).toEqual([
      {
        name: 'import',
        args: [ID, 14, '977ae00c34126a1c073815f483d1869ee09894533641771199f8803ff0967cc1'],
      },
    ]);
  });

  it('accepts octet-stream and a missing content type', async () => {
    const url = `${await boot()}/${ID}/import`;
    expect((await fetch(url, upload('x', 'application/octet-stream'))).status).toBe(200);
    expect((await fetch(url, upload('x', undefined))).status).toBe(200);
  });

  it('answers a malformed id as an unknown store, before reading the body', async () => {
    const response = await fetch(`${await boot()}/not-an-id/import`, upload('x'));
    expect(response.status).toBe(404);
    expect(await codeOf(response)).toBe('STORE_NOT_FOUND');
    expect(calls).toEqual([]);
  });

  it('answers 415 for a JSON body without reaching the use case', async () => {
    const response = await fetch(`${await boot()}/${ID}/import`, upload('{}', 'application/json'));
    expect(response.status).toBe(415);
    expect(await codeOf(response)).toBe('WORKBOOK_UNSUPPORTED_MEDIA_TYPE');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(calls).toEqual([]);
  });

  it('answers 400 for an empty body and 413 for a body over the limit', async () => {
    const url = `${await boot()}/${ID}/import`;
    const empty = await fetch(url, { method: 'POST' });
    expect([empty.status, await codeOf(empty)]).toEqual([400, 'WORKBOOK_FILE_REQUIRED']);
    const large = await fetch(url, upload(new Uint8Array(65)));
    expect([large.status, await codeOf(large)]).toEqual([413, 'WORKBOOK_TOO_LARGE']);
    expect(calls).toEqual([]);
  });

  it('answers 422 with the report when the workbook has errors', async () => {
    const report = {
      valid: false,
      fileSha256: 'a'.repeat(64),
      summary: { errorCount: 1, warningCount: 0 },
      truncated: false,
      issues: [],
    };
    importBehaviour = () => Promise.reject(new WorkbookInvalidError(report));
    const response = await fetch(`${await boot()}/${ID}/import`, upload('x'));
    expect(response.status).toBe(422);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      error: {
        code: 'WORKBOOK_INVALID',
        message: 'The workbook has errors. Nothing was sent to Shopify.',
      },
      report,
    });
  });

  it.each([
    [new StoreNotConnectedError(), 409, 'STORE_NOT_CONNECTED'],
    [new ShopifyRequestFailedError(), 502, 'SHOPIFY_REQUEST_FAILED'],
  ])('maps %s to its status and code', async (error, status, code) => {
    importBehaviour = () => Promise.reject(error);
    const response = await fetch(`${await boot()}/${ID}/import`, upload('x'));
    expect(response.status).toBe(status);
    expect(await codeOf(response)).toBe(code);
  });

  it('answers an unexpected error with the generic 500 and logs only its name', async () => {
    importBehaviour = () =>
      Promise.reject(new TypeError('boom shpat_SECRET_VALUE_1234 https://shop.example/x'));
    const response = await fetch(`${await boot()}/${ID}/import`, upload('x'));
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).toBe('{"statusCode":500,"message":"Internal server error"}');
    expect(JSON.stringify(logged)).not.toContain('SECRET');
    expect(logged).toEqual([{ event: 'store_request_failed', errorName: 'TypeError' }]);
  });
});
