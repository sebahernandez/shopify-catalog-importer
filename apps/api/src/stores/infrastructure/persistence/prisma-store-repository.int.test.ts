import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { VerificationSnapshot } from '@importer/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../../persistence/prisma.service.js';
import { applyMigrations } from '../../../persistence/test-support/apply-migrations.js';
import { AesGcmSecretBox } from '../../../shared-kernel/secret-box/infrastructure/aes-gcm-secret-box.js';
import { parseShopDomain } from '../../domain/shop-domain.js';
import type { Store } from '../../domain/store.js';
import { newStore } from '../../domain/store-rules.js';
import {
  DuplicateShopDomainError,
  type VerificationRecord,
} from '../../ports/store-repository.port.js';
import { PrismaStoreRepository } from './prisma-store-repository.js';

const T0 = '2026-10-15T10:00:00.000Z';
const CANARY = 'canary-plaintext-secret-0001';
const SNAPSHOT: VerificationSnapshot = {
  ok: true,
  checkedAt: T0,
  shop: null,
  apiVersion: { requested: '2026-07', used: '2026-07' },
  scopes: { granted: ['read_products'], required: ['read_products'], missing: [] },
  locationsTruncated: false,
  problems: [],
  locationCount: 2,
};

let sandbox: string;
let service: PrismaService;
let nowMs: number;
let repository: PrismaStoreRepository;
const warn = vi.fn();
const logger = { warn } as unknown as ConstructorParameters<typeof PrismaStoreRepository>[2];

function make(id: string, domain: string, createdAt = T0, envelope = `env-${id}`): Store {
  const parsed = parseShopDomain(domain);
  if (!parsed.ok) throw new Error('bad test domain');
  const input = { id, displayName: `Shop ${id}`, shopDomain: parsed.domain };
  return newStore({ ...input, authKind: 'static_token', credentialsEnvelope: envelope }, createdAt);
}

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), 'importer-store-repo-'));
  expect(applyMigrations(sandbox).status).toBe(0);
  service = new PrismaService({ dataDir: join(sandbox, 'data'), busyTimeoutMs: 1000 });
  await service.connect();
  nowMs = Date.parse('2026-10-15T11:00:00.000Z');
  warn.mockClear();
  repository = new PrismaStoreRepository(service, { nowMs: () => nowMs }, logger);
});

afterEach(async () => {
  await service?.disconnect();
  await rm(sandbox, { recursive: true, force: true });
});

const count = (): Promise<number> => service.client.store.count();
const rawUpdate = (column: string, id: string, value: string): Promise<number> =>
  service.client.$executeRawUnsafe(`UPDATE store SET ${column} = ? WHERE id = ?`, value, id);

describe('PrismaStoreRepository', () => {
  it('stores and reads every field with ISO 8601 UTC dates and null verification fields', async () => {
    const store = make('s1', 'demo.myshopify.com');
    await repository.insert(store);
    expect(await repository.findById('s1')).toEqual(store);
    const verified: Store = {
      ...make('s2', 'two.myshopify.com'),
      shopifyShopId: 'gid://shopify/Shop/1',
      apiVersion: '2026-07',
      status: 'CONNECTED',
      lastVerifiedAt: T0,
      lastVerification: SNAPSHOT,
    };
    await repository.insert(verified);
    expect(await repository.findById('s2')).toEqual(verified);
  });

  it('lists by createdAt ascending then id, and answers null for an unknown id', async () => {
    await repository.insert(make('b', 'shop-b.myshopify.com', '2026-10-15T10:00:01.000Z'));
    await repository.insert(make('z', 'shop-z.myshopify.com', T0));
    await repository.insert(make('a', 'shop-a.myshopify.com', '2026-10-15T10:00:01.000Z'));
    expect((await repository.list()).map((s) => s.id)).toEqual(['z', 'a', 'b']);
    expect(await repository.findById('missing')).toBeNull();
  });

  it('maps a duplicate domain to DuplicateShopDomainError and keeps the row count', async () => {
    await repository.insert(make('s1', 'demo.myshopify.com'));
    const failure = repository.insert(make('s2', 'demo.myshopify.com', T0, CANARY));
    await expect(failure).rejects.toBeInstanceOf(DuplicateShopDomainError);
    await expect(failure).rejects.toThrow(/^(?!.*canary)/);
    expect(await count()).toBe(1);
  });

  it('leaves exactly one row when two inserts of one domain run concurrently', async () => {
    const results = await Promise.allSettled([
      repository.insert(make('s1', 'demo.myshopify.com')),
      repository.insert(make('s2', 'demo.myshopify.com')),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    const loser = results.find((r) => r.status === 'rejected');
    expect(loser?.reason).toBeInstanceOf(DuplicateShopDomainError);
    expect(await count()).toBe(1);
  });

  it('replaces credentials, resets verification and never moves updatedAt earlier', async () => {
    const verified: Store = {
      ...make('s1', 'demo.myshopify.com'),
      shopifyShopId: 'gid://shopify/Shop/1',
      apiVersion: '2026-07',
      status: 'CONNECTED',
      lastVerifiedAt: T0,
      lastVerification: SNAPSHOT,
    };
    await repository.insert(verified);
    const next = { authKind: 'client_credentials', credentialsEnvelope: 'env-new' } as const;
    const replaced = await repository.replaceCredentials('s1', next);
    expect(replaced).toEqual({
      ...make('s1', 'demo.myshopify.com', T0, 'env-new'),
      authKind: 'client_credentials',
      updatedAt: '2026-10-15T11:00:00.000Z',
    });
    expect(await repository.findById('s1')).toEqual(replaced);
    nowMs = Date.parse(T0);
    const again = await repository.replaceCredentials('s1', next);
    expect(again?.updatedAt).toBe('2026-10-15T11:00:00.000Z');
    expect(await repository.replaceCredentials('missing', next)).toBeNull();
  });

  it('deletes the row, reports an unknown id and frees the domain with a new id', async () => {
    await repository.insert(make('s1', 'demo.myshopify.com'));
    expect(await repository.delete('s1')).toBe(true);
    expect(await count()).toBe(0);
    expect(await repository.delete('s1')).toBe(false);
    await repository.insert(make('s2', 'demo.myshopify.com'));
    expect((await repository.list()).map((s) => s.id)).toEqual(['s2']);
  });

  it('reads a corrupt last_verification as null and warns without any content', async () => {
    await repository.insert(make('s1', 'demo.myshopify.com'));
    await rawUpdate('last_verification', 's1', `{"canary":"${CANARY}"`);
    expect((await repository.findById('s1'))?.lastVerification).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/canary|env-s1|demo/);
  });

  it.each(['status', 'auth_kind'])(
    'rejects an unknown stored %s without its value',
    async (column) => {
      await repository.insert(make('s1', 'demo.myshopify.com'));
      await rawUpdate(column, 's1', 'SECRET-VALUE-XYZ');
      for (const read of [() => repository.findById('s1'), () => repository.list()]) {
        const failure = read().catch((error: unknown) => error);
        const error = await failure;
        expect(error).toBeInstanceOf(Error);
        expect(JSON.stringify([(error as Error).message, (error as Error).stack])).not.toMatch(
          /SECRET-VALUE|env-s1|demo/,
        );
      }
    },
  );

  it('holds no plaintext secret in any column of the stored row', async () => {
    const keyring = { activeKeyId: 'k1', keys: new Map([['k1', Buffer.alloc(32, 0x33)]]) };
    const envelope = new AesGcmSecretBox(keyring).encrypt(CANARY, 'store:s1:credentials');
    await repository.insert(make('s1', 'demo.myshopify.com', T0, envelope));
    const rows =
      await service.client.$queryRawUnsafe<Record<string, unknown>[]>('SELECT * FROM store');
    expect(rows).toHaveLength(1);
    expect(
      JSON.stringify(rows, (_k, v: unknown) => (typeof v === 'bigint' ? v.toString() : v)),
    ).not.toContain(CANARY);
    expect(rows[0]?.['credentials_envelope']).toBe(envelope);
  });

  describe('recordVerification (D19)', () => {
    const record = (over: Partial<VerificationRecord> = {}): VerificationRecord => ({
      status: 'CONNECTED',
      lastVerifiedAt: T0,
      shopifyShopId: 'gid://shopify/Shop/9',
      apiVersion: '2026-10',
      snapshot: SNAPSHOT,
      ...over,
    });

    it('updates only a row whose envelope still matches and reports it', async () => {
      await repository.insert(make('s1', 'demo.myshopify.com'));
      expect(await repository.recordVerification('s1', 'env-s1', record())).toBe(true);
      const stored = await repository.findById('s1');
      expect(stored).toMatchObject({
        status: 'CONNECTED',
        lastVerifiedAt: T0,
        shopifyShopId: 'gid://shopify/Shop/9',
        apiVersion: '2026-10',
        lastVerification: SNAPSHOT,
        displayName: 'Shop s1',
        shopDomain: 'demo.myshopify.com',
        credentialsEnvelope: 'env-s1',
      });
    });

    it('changes zero rows for a replaced envelope or a deleted store', async () => {
      await repository.insert(make('s1', 'demo.myshopify.com'));
      await repository.replaceCredentials('s1', {
        authKind: 'static_token',
        credentialsEnvelope: 'env-new',
      });
      expect(await repository.recordVerification('s1', 'env-s1', record())).toBe(false);
      expect((await repository.findById('s1'))?.status).toBe('UNVERIFIED');
      await repository.delete('s1');
      expect(await repository.recordVerification('s1', 'env-new', record())).toBe(false);
    });

    it('stores the snapshot as JSON TEXT without any location name or id', async () => {
      await repository.insert(make('s1', 'demo.myshopify.com'));
      await repository.recordVerification('s1', 'env-s1', record());
      const rows = await service.client.$queryRawUnsafe<
        { type: string; text: string; count: number }[]
      >(
        `SELECT typeof(last_verification) AS type, last_verification AS text FROM store WHERE id = 's1'`,
      );
      expect(rows[0]?.type).toBe('text');
      const parsed = JSON.parse(rows[0]?.text ?? '') as Record<string, unknown>;
      expect(parsed['locationCount']).toBe(2);
      expect(parsed).not.toHaveProperty('locations');
    });

    it('persists a failure and keeps shopifyShopId when none was obtained', async () => {
      await repository.insert({ ...make('s1', 'demo.myshopify.com'), shopifyShopId: 'gid://keep' });
      await repository.recordVerification(
        's1',
        'env-s1',
        record({ status: 'AUTH_FAILED', shopifyShopId: null }),
      );
      expect(await repository.findById('s1')).toMatchObject({
        status: 'AUTH_FAILED',
        lastVerifiedAt: T0,
        shopifyShopId: 'gid://keep',
      });
    });

    it('records the given api version, for example a fall-forward', async () => {
      await repository.insert(make('s1', 'demo.myshopify.com'));
      await repository.recordVerification('s1', 'env-s1', record({ apiVersion: '2027-01' }));
      expect((await repository.findById('s1'))?.apiVersion).toBe('2027-01');
    });

    it('clears the snapshot when credentials are replaced', async () => {
      await repository.insert(make('s1', 'demo.myshopify.com'));
      await repository.recordVerification('s1', 'env-s1', record());
      const next = { authKind: 'static_token', credentialsEnvelope: 'env-2' } as const;
      await repository.replaceCredentials('s1', next);
      expect(await repository.findById('s1')).toMatchObject({
        lastVerification: null,
        lastVerifiedAt: null,
      });
    });
  });
});
