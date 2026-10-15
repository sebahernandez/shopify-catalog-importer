import { readFileSync } from 'node:fs';
import { Logger } from '@nestjs/common';
import Database from 'better-sqlite3';
import { StoreSummary, StoreVerification } from '@importer/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PersistenceError } from '../../../persistence/persistence-error.js';
import {
  bootStoreApp,
  forbidProcessExit,
  makeSandbox,
  removeSandbox,
  shopDomainOf,
  type Sandbox,
  type StoreApp,
} from '../../test-support/store-app-harness.js';
import { ALL_SCOPES } from '../../test-support/store-use-case-harness.js';

// Task 18.5: the real `bootstrap()` on a migrated sandbox (isolated environment, temporary data and
// key folders, loopback, port 0, the simulator through `storeOverrides`).
const TOKEN = 'static-token-canary-boot-0001';
const CREDS = { kind: 'static_token', accessToken: TOKEN } as const;
const SHOP = {
  name: 'Boot shop',
  currencyCode: 'USD',
  planName: 'Basic',
  shopifyPlus: false,
  partnerDevelopment: false,
  scopes: ALL_SCOPES,
  locations: [
    { id: 'gid://shopify/Location/1', name: 'Main', isActive: true, fulfillsOnlineOrders: true },
  ],
};

let sandbox: Sandbox;
let app: StoreApp | undefined;

beforeEach(async () => {
  forbidProcessExit();
  sandbox = await makeSandbox();
});
afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.restoreAllMocks();
  await removeSandbox(sandbox);
});

const envelopeOf = (path: string): string => {
  const db = new Database(path, { readonly: true });
  try {
    return (db.prepare('SELECT credentials_envelope AS e FROM store').get() as { e: string }).e;
  } finally {
    db.close();
  }
};

describe('bootstrap() with the stores module', () => {
  it('creates and verifies a store through the routes with the reconciled key', async () => {
    app = await bootStoreApp(sandbox);
    app.simulator.addShop(shopDomainOf('boot.myshopify.com'), SHOP);
    const created = await app.send('POST', '/api/stores', {
      json: { displayName: 'Boot', domain: 'boot', credentials: CREDS },
    });
    expect(created.status).toBe(201);
    const { id } = StoreSummary.parse(JSON.parse(created.body));
    const verified = await app.send('POST', `/api/stores/${id}/verify`);
    expect(verified.status).toBe(200);
    expect(StoreVerification.parse(JSON.parse(verified.body)).ok).toBe(true);
    expect(envelopeOf(app.databasePath).startsWith('sb1.')).toBe(true);
  });

  it('opens the stored envelope after a restart, because the same key is reconciled', async () => {
    app = await bootStoreApp(sandbox);
    const created = await app.send('POST', '/api/stores', {
      json: { displayName: 'Boot', domain: 'boot', credentials: CREDS },
    });
    const { id } = StoreSummary.parse(JSON.parse(created.body));
    await app.close();
    app = await bootStoreApp(sandbox);
    app.simulator.addShop(shopDomainOf('boot.myshopify.com'), SHOP);
    const verified = await app.send('POST', `/api/stores/${id}/verify`);
    expect(StoreVerification.parse(JSON.parse(verified.body)).ok).toBe(true);
    expect(readFileSync(sandbox.keyFile, 'utf8')).not.toContain(TOKEN);
  });

  it('prints a decrypted canary as [REDACTED] through the application logger', async () => {
    app = await bootStoreApp(sandbox);
    await app.send('POST', '/api/stores', {
      json: { displayName: 'Boot', domain: 'boot', credentials: CREDS },
    });
    const context = `store:${
      (JSON.parse((await app.send('GET', '/api/stores')).body) as { stores: { id: string }[] })
        .stores[0]!.id
    }:credentials`;
    const plain = app.box.decrypt(envelopeOf(app.databasePath), context);
    expect(plain).toContain(TOKEN);
    new Logger('Canary').log(plain);
    const printed = app.lines.at(-1) ?? '';
    expect(printed).toContain('[REDACTED]');
    expect(printed).not.toContain(TOKEN);
    expect(app.lines.join('\n')).not.toContain(TOKEN);
  });

  it('aborts startup with MIGRATION_REQUIRED on a database at the baseline only', async () => {
    const baseline = await makeSandbox({ migrate: 'baseline' });
    try {
      const error: unknown = await bootStoreApp(baseline).catch((thrown: unknown) => thrown);
      expect(error).toBeInstanceOf(PersistenceError);
      expect(error).toMatchObject({ code: 'MIGRATION_REQUIRED' });
    } finally {
      await removeSandbox(baseline);
    }
  });
});
