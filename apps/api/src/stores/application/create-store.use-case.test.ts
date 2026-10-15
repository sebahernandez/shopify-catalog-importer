import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Clock } from '../../shared-kernel/time/clock.port.js';
import { ID_1, ID_2, STATIC, T0, makeHarness } from '../test-support/store-use-case-harness.js';
import { CreateStoreUseCase } from './create-store.use-case.js';
import {
  StoreAlreadyExistsError,
  StoreCredentialsInvalidError,
  StoreDisplayNameInvalidError,
  StoreDomainInvalidError,
} from './store-errors.js';

const clock: Clock = { nowMs: () => Date.parse(T0) };

function setup() {
  const harness = makeHarness();
  const ids = [ID_1, ID_2];
  const gatewayCalls = vi.fn();
  const fetchSpy = vi.fn(() => {
    throw new Error('create must stay offline');
  });
  vi.stubGlobal('fetch', fetchSpy);
  const useCase = new CreateStoreUseCase({
    repository: harness.repository,
    vault: harness.vault,
    clock,
    idGenerator: { next: () => ids.shift() ?? ID_2 },
  });
  const input = (over: Partial<{ displayName: string; domain: string; credentials: unknown }>) =>
    ({ displayName: 'Shop', domain: 'demo.myshopify.com', credentials: STATIC, ...over }) as never;
  return { harness, useCase, input, fetchSpy, gatewayCalls };
}

afterEach(() => vi.unstubAllGlobals());

describe('CreateStoreUseCase', () => {
  it('creates an UNVERIFIED store offline with a generated id and equal timestamps', async () => {
    const { useCase, input, fetchSpy, gatewayCalls } = setup();
    const summary = await useCase.execute(input({}));
    expect(summary).toMatchObject({
      id: ID_1,
      status: 'UNVERIFIED',
      hasCredentials: true,
      createdAt: T0,
      updatedAt: T0,
      shopDomain: 'demo.myshopify.com',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(gatewayCalls).not.toHaveBeenCalled();
  });

  it('accepts 1 and 80 character names and rejects empty, blank and 81 character names', async () => {
    const { harness, useCase, input } = setup();
    await useCase.execute(input({ displayName: 'a' }));
    await useCase.execute(input({ displayName: 'b'.repeat(80), domain: 'two.myshopify.com' }));
    for (const displayName of ['', '   ', 'c'.repeat(81)]) {
      await expect(
        useCase.execute(input({ displayName, domain: 'three.myshopify.com' })),
      ).rejects.toBeInstanceOf(StoreDisplayNameInvalidError);
    }
    expect(harness.repository.rows.size).toBe(2);
  });

  it('allows the same name for different domains', async () => {
    const { useCase, input } = setup();
    await useCase.execute(input({}));
    await expect(useCase.execute(input({ domain: 'other.myshopify.com' }))).resolves.toBeDefined();
  });

  it('refuses a duplicate canonical domain and leaves the rows unchanged', async () => {
    const { harness, useCase, input } = setup();
    await useCase.execute(input({}));
    await expect(
      useCase.execute(input({ domain: 'https://DEMO.myshopify.com/admin/products' })),
    ).rejects.toBeInstanceOf(StoreAlreadyExistsError);
    expect(harness.repository.rows.size).toBe(1);
  });

  it('maps a repository duplicate raised by a race to StoreAlreadyExistsError', async () => {
    const { harness, useCase, input } = setup();
    await harness.addStore(ID_2, 'demo.myshopify.com', STATIC);
    await expect(useCase.execute(input({}))).rejects.toBeInstanceOf(StoreAlreadyExistsError);
  });

  it('reports an invalid domain with its reason, with no fetch and no row', async () => {
    const { harness, useCase, input, fetchSpy } = setup();
    const error: unknown = await useCase
      .execute(input({ domain: 'evil.example.com' }))
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(StoreDomainInvalidError);
    const invalid = error as StoreDomainInvalidError;
    expect(invalid.reason).toBe('WRONG_SUFFIX');
    expect(invalid.message).not.toContain('evil');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(harness.repository.rows.size).toBe(0);
  });

  it('reports invalid credentials, checking the domain first', async () => {
    const { harness, useCase, input } = setup();
    await expect(
      useCase.execute(input({ credentials: { kind: 'static_token' } })),
    ).rejects.toBeInstanceOf(StoreCredentialsInvalidError);
    await expect(
      useCase.execute(input({ domain: 'bad domain', credentials: { kind: 'nope' } })),
    ).rejects.toBeInstanceOf(StoreDomainInvalidError);
    expect(harness.repository.rows.size).toBe(0);
  });

  it('stores only a sealed envelope bound to the lower case store context', async () => {
    const { harness, useCase, input } = setup();
    await useCase.execute(input({}));
    const row = harness.repository.rows.get(ID_1);
    expect(row?.credentialsEnvelope.startsWith('sb1.')).toBe(true);
    expect(JSON.stringify(row)).not.toContain('static-token-canary-0001');
    expect(
      harness.box.decrypt(row?.credentialsEnvelope ?? '', `store:${ID_1}:credentials`),
    ).toContain('static-token-canary-0001');
  });
});
