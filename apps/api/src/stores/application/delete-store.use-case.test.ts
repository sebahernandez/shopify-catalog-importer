import { describe, expect, it, vi } from 'vitest';
import type { Clock } from '../../shared-kernel/time/clock.port.js';
import { ID_1, ID_2, STATIC, T0, makeHarness } from '../test-support/store-use-case-harness.js';
import { CreateStoreUseCase } from './create-store.use-case.js';
import { DeleteStoreUseCase } from './delete-store.use-case.js';
import { GetStoreUseCase } from './get-store.use-case.js';
import { StoreNotFoundError } from './store-errors.js';

const CLIENT = {
  kind: 'client_credentials',
  clientId: 'client-id-1',
  clientSecret: 'client-secret-0001',
} as const;

async function setup() {
  const harness = makeHarness();
  await harness.addStore(ID_1, 'demo.myshopify.com', CLIENT);
  const forget = vi.spyOn(harness.registry, 'forget');
  const useCase = new DeleteStoreUseCase({
    repository: harness.repository,
    registry: harness.registry,
  });
  return { harness, forget, useCase };
}

describe('DeleteStoreUseCase', () => {
  it('removes the row, reports not found afterwards and leaves no envelope', async () => {
    const { harness, useCase } = await setup();
    await useCase.execute(ID_1);
    await expect(
      new GetStoreUseCase({ repository: harness.repository }).execute(ID_1),
    ).rejects.toBeInstanceOf(StoreNotFoundError);
    expect(JSON.stringify([...harness.repository.rows.values()])).not.toContain('sb1.');
  });

  it('drops the cached token', async () => {
    const { harness, forget, useCase } = await setup();
    const row = await harness.repository.findById(ID_1);
    await harness.registry.forStore(row as never).accessToken();
    await useCase.execute(ID_1);
    expect(forget).toHaveBeenCalledWith(ID_1);
    await harness.registry.forStore(row as never).accessToken();
    expect(harness.exchanged.length).toBe(2);
  });

  it('allows the same domain to be created again with a new id', async () => {
    const { harness, useCase } = await setup();
    await useCase.execute(ID_1);
    const clock: Clock = { nowMs: () => Date.parse(T0) };
    const create = new CreateStoreUseCase({
      repository: harness.repository,
      vault: harness.vault,
      clock,
      idGenerator: { next: () => ID_2 },
    });
    const summary = await create.execute({
      displayName: 'Again',
      domain: 'demo.myshopify.com',
      credentials: STATIC,
    });
    expect(summary.id).toBe(ID_2);
  });

  it('reports not found for unknown and malformed ids without forgetting anything', async () => {
    const { forget, useCase } = await setup();
    for (const id of ['33333333-3333-4333-8333-333333333333', 'not-a-uuid']) {
      await expect(useCase.execute(id)).rejects.toBeInstanceOf(StoreNotFoundError);
    }
    expect(forget).not.toHaveBeenCalled();
  });
});
