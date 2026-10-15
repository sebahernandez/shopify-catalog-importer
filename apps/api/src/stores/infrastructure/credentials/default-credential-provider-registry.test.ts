import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearRegisteredSecretsForTests } from '../../../shared-kernel/logging/redact.js';
import { AesGcmSecretBox } from '../../../shared-kernel/secret-box/infrastructure/aes-gcm-secret-box.js';
import type { CredentialsPayload } from '../../domain/credentials-payload.js';
import { parseShopDomain } from '../../domain/shop-domain.js';
import type { Store } from '../../domain/store.js';
import { CredentialsUnreadableError } from './credentials-unreadable.error.js';
import { DefaultCredentialProviderRegistry } from './default-credential-provider-registry.js';
import { StaticTokenProvider } from './static-token-provider.js';
import { StoreCredentialVault } from './store-credential-vault.js';

const keyring = { activeKeyId: 'k1', keys: new Map([['k1', Buffer.alloc(32, 0x44)]]) };
const vault = new StoreCredentialVault(new AesGcmSecretBox(keyring));
const parsed = parseShopDomain('acme.myshopify.com');
if (!parsed.ok) throw new Error('fixture domain');
const DOMAIN = parsed.domain;
const PAIR: CredentialsPayload = {
  kind: 'client_credentials',
  clientId: 'synthetic-client-id-1',
  clientSecret: 'synthetic-client-secret-1',
};

function record(id: string, payload: CredentialsPayload, envelope?: string): Store {
  return {
    id,
    displayName: id,
    shopDomain: DOMAIN,
    shopifyShopId: null,
    apiVersion: null,
    authKind: payload.kind,
    credentialsEnvelope: envelope ?? vault.seal(id, payload),
    status: 'UNVERIFIED',
    lastVerifiedAt: null,
    lastVerification: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function setup() {
  let calls = 0;
  const exchange = vi.fn(() => {
    calls += 1;
    return Promise.resolve({ accessToken: `token-${calls}`, expiresAtMs: 10 ** 12 });
  });
  const registry = new DefaultCredentialProviderRegistry({
    vault,
    exchanger: { exchange },
    now: () => 0,
  });
  return { exchange, registry };
}

beforeEach(clearRegisteredSecretsForTests);

describe('DefaultCredentialProviderRegistry', () => {
  it('builds a static provider and a client-credentials provider by kind', () => {
    const { registry } = setup();
    const staticRecord = record('s1', { kind: 'static_token', accessToken: 'synthetic-token-001' });
    expect(registry.forStore(staticRecord)).toBeInstanceOf(StaticTokenProvider);
    expect(registry.forStore(record('s2', PAIR)).authKind).toBe('client_credentials');
  });

  it('keeps the cached token across requests for the same id and envelope', async () => {
    const { registry, exchange } = setup();
    const store = record('s1', PAIR);
    const first = registry.forStore(store);
    expect(registry.forStore(store)).toBe(first);
    await first.accessToken();
    await registry.forStore(store).accessToken();
    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it('returns a new provider with an empty cache when the envelope changes', async () => {
    const { registry, exchange } = setup();
    const old = registry.forStore(record('s1', PAIR));
    await old.accessToken();
    const replaced = registry.forStore(record('s1', PAIR));
    expect(replaced).not.toBe(old);
    await expect(replaced.accessToken()).resolves.toBe('token-2');
    expect(exchange).toHaveBeenCalledTimes(2);
  });

  it('forgets a store so the next request exchanges again', async () => {
    const { registry, exchange } = setup();
    const store = record('s1', PAIR);
    await registry.forStore(store).accessToken();
    registry.forget('s1');
    await registry.forStore(store).accessToken();
    expect(exchange).toHaveBeenCalledTimes(2);
  });

  it('reports swapped envelopes unreadable with no outbound call', () => {
    const { registry, exchange } = setup();
    const a = record('a', PAIR);
    const b = record('b', PAIR);
    expect(() => registry.forStore({ ...a, credentialsEnvelope: b.credentialsEnvelope })).toThrow(
      CredentialsUnreadableError,
    );
    expect(() => registry.forStore({ ...b, credentialsEnvelope: a.credentialsEnvelope })).toThrow(
      CredentialsUnreadableError,
    );
    expect(exchange).not.toHaveBeenCalled();
  });

  it('surfaces garbage and wrong-kind envelopes as unreadable', () => {
    const { registry } = setup();
    expect(() => registry.forStore(record('s1', PAIR, 'garbage'))).toThrow(
      CredentialsUnreadableError,
    );
    const wrongKind = { ...record('s1', PAIR), authKind: 'static_token' as const };
    expect(() => registry.forStore(wrongKind)).toThrow(CredentialsUnreadableError);
  });

  it('keeps stores independent', async () => {
    const { registry, exchange } = setup();
    const a = registry.forStore(record('a', PAIR));
    const b = registry.forStore(record('b', PAIR));
    await a.accessToken();
    await b.accessToken();
    registry.forget('a');
    await b.accessToken();
    expect(exchange).toHaveBeenCalledTimes(2);
    expect(b).toBe(registry.forStore(record('b', PAIR, undefined)) === b ? b : b);
  });
});
