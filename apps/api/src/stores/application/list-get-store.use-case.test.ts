import { describe, expect, it, vi } from 'vitest';
import { ID_1, ID_2, STATIC, makeHarness } from '../test-support/store-use-case-harness.js';
import { GetStoreUseCase } from './get-store.use-case.js';
import { ListStoresUseCase } from './list-stores.use-case.js';
import { StoreNotFoundError } from './store-errors.js';

const ID_3 = '33333333-3333-4333-8333-333333333333';

async function setup() {
  const harness = makeHarness();
  await harness.addStore(ID_2, 'two.myshopify.com', STATIC);
  await harness.addStore(ID_1, 'one.myshopify.com', STATIC);
  const encrypt = vi.spyOn(harness.box, 'encrypt');
  const decrypt = vi.spyOn(harness.box, 'decrypt');
  const gateway = vi.spyOn(harness.simulator, 'getShopInfo');
  const snapshot = JSON.stringify([...harness.repository.rows.values()]);
  return { harness, encrypt, decrypt, gateway, snapshot };
}

describe('list and get store', () => {
  it('lists by createdAt ascending then id', async () => {
    const { harness } = await setup();
    const summaries = await new ListStoresUseCase({ repository: harness.repository }).execute();
    expect(summaries.map((s) => s.id)).toEqual([ID_1, ID_2]);
  });

  it('returns exactly the 12 summary fields with null verification fields when unverified', async () => {
    const { harness } = await setup();
    const summary = await new GetStoreUseCase({ repository: harness.repository }).execute(ID_1);
    expect(Object.keys(summary).sort()).toEqual(
      [
        'id',
        'displayName',
        'shopDomain',
        'shopifyShopId',
        'apiVersion',
        'authKind',
        'status',
        'hasCredentials',
        'lastVerifiedAt',
        'lastVerification',
        'createdAt',
        'updatedAt',
      ].sort(),
    );
    expect(summary).toMatchObject({
      lastVerifiedAt: null,
      lastVerification: null,
      hasCredentials: true,
    });
    const text = JSON.stringify(summary);
    expect(text).not.toContain('static-token-canary-0001');
    expect(text).not.toContain('sb1.');
  });

  it('has no side effects: no crypto, no gateway call, no write, row unchanged', async () => {
    const { harness, encrypt, decrypt, gateway, snapshot } = await setup();
    await new ListStoresUseCase({ repository: harness.repository }).execute();
    await new GetStoreUseCase({ repository: harness.repository }).execute(ID_1);
    expect(encrypt).not.toHaveBeenCalled();
    expect(decrypt).not.toHaveBeenCalled();
    expect(gateway).not.toHaveBeenCalled();
    expect(harness.repository.writes).toBe(0);
    expect(JSON.stringify([...harness.repository.rows.values()])).toBe(snapshot);
  });

  it('answers an unknown and a malformed id with StoreNotFoundError, never reading for the latter', async () => {
    const { harness } = await setup();
    const get = new GetStoreUseCase({ repository: harness.repository });
    await expect(get.execute(ID_3)).rejects.toBeInstanceOf(StoreNotFoundError);
    const reads = harness.repository.reads;
    await expect(get.execute('not-a-uuid')).rejects.toBeInstanceOf(StoreNotFoundError);
    expect(harness.repository.reads).toBe(reads);
  });
});
