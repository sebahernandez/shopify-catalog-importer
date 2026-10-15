import type { CredentialsPayload } from '@importer/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ID_1, STATIC, makeHarness } from '../test-support/store-use-case-harness.js';
import { ReplaceCredentialsUseCase } from './replace-credentials.use-case.js';
import { StoreCredentialsInvalidError, StoreNotFoundError } from './store-errors.js';

const NEW_CANARY = 'new-client-secret-canary-0002';
const CLIENT: CredentialsPayload = {
  kind: 'client_credentials',
  clientId: 'client-id-1',
  clientSecret: NEW_CANARY,
};

afterEach(() => vi.unstubAllGlobals());

async function setup() {
  const harness = makeHarness();
  const fetchSpy = vi.fn(() => {
    throw new Error('replace must stay offline');
  });
  vi.stubGlobal('fetch', fetchSpy);
  const before = await harness.addStore(ID_1, 'demo.myshopify.com', STATIC);
  await harness.repository.recordVerification(ID_1, before.credentialsEnvelope, {
    status: 'CONNECTED',
    lastVerifiedAt: '2026-10-15T10:00:00.000Z',
    shopifyShopId: '1',
    apiVersion: '2026-10',
    snapshot: {} as never,
  });
  const forget = vi.spyOn(harness.registry, 'forget');
  const useCase = new ReplaceCredentialsUseCase({
    repository: harness.repository,
    vault: harness.vault,
    registry: harness.registry,
  });
  return { harness, fetchSpy, before, forget, useCase };
}

describe('ReplaceCredentialsUseCase', () => {
  it('resets a CONNECTED store to UNVERIFIED, changes the kind and keeps identity fields', async () => {
    const { before, useCase, fetchSpy } = await setup();
    const summary = await useCase.execute(ID_1, { credentials: CLIENT });
    expect(summary).toMatchObject({
      status: 'UNVERIFIED',
      authKind: 'client_credentials',
      lastVerifiedAt: null,
      lastVerification: null,
      shopifyShopId: null,
      apiVersion: null,
      id: before.id,
      displayName: before.displayName,
      shopDomain: before.shopDomain,
      createdAt: before.createdAt,
    });
    expect(summary.updatedAt >= before.updatedAt).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('seals under the same store context and forgets the cached token', async () => {
    const { harness, forget, useCase } = await setup();
    await useCase.execute(ID_1, { credentials: CLIENT });
    const first = await harness.repository.findById(ID_1);
    await harness.registry.forStore(first as never).accessToken();
    await harness.registry.forStore(first as never).accessToken();
    expect(harness.exchanged.length).toBe(1);
    await useCase.execute(ID_1, { credentials: { ...CLIENT, clientId: 'client-id-2' } });
    const second = await harness.repository.findById(ID_1);
    await harness.registry.forStore(second as never).accessToken();
    expect(harness.exchanged.length).toBe(2);
    expect(forget).toHaveBeenCalledWith(ID_1);
    expect(
      harness.vault.open(ID_1, 'client_credentials', second?.credentialsEnvelope ?? ''),
    ).toEqual({ ...CLIENT, clientId: 'client-id-2' });
  });

  it('changes nothing for invalid credentials', async () => {
    const { harness, useCase, forget } = await setup();
    const row = await harness.repository.findById(ID_1);
    harness.repository.writes = 0;
    await expect(
      useCase.execute(ID_1, { credentials: { kind: 'static_token' } as never }),
    ).rejects.toBeInstanceOf(StoreCredentialsInvalidError);
    expect(harness.repository.writes).toBe(0);
    expect(forget).not.toHaveBeenCalled();
    expect(await harness.repository.findById(ID_1)).toEqual(row);
  });

  it('answers unknown and malformed ids with StoreNotFoundError', async () => {
    const { useCase } = await setup();
    for (const id of ['33333333-3333-4333-8333-333333333333', 'not-a-uuid']) {
      await expect(useCase.execute(id, { credentials: CLIENT })).rejects.toBeInstanceOf(
        StoreNotFoundError,
      );
    }
  });

  it('never returns the old or the new secret', async () => {
    const { useCase } = await setup();
    const text = JSON.stringify(await useCase.execute(ID_1, { credentials: CLIENT }));
    expect(text).not.toContain('static-token-canary-0001');
    expect(text).not.toContain(NEW_CANARY);
  });
});
