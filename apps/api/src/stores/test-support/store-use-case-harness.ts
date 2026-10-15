import type { CredentialsPayload as CredentialsBody } from '@importer/contracts';
import { AesGcmSecretBox } from '../../shared-kernel/secret-box/infrastructure/aes-gcm-secret-box.js';
import { DefaultCredentialProviderRegistry } from '../infrastructure/credentials/default-credential-provider-registry.js';
import { StoreCredentialVault } from '../infrastructure/credentials/store-credential-vault.js';
import { SimulatedShopifyGateway } from '../infrastructure/simulator/simulated-shopify-gateway.js';
import { parseShopDomain, type ShopDomain } from '../domain/shop-domain.js';
import type { Store } from '../domain/store.js';
import { newStore, replaceCredentials } from '../domain/store-rules.js';
import {
  DuplicateShopDomainError,
  type StoreRepository,
  type VerificationRecord,
} from '../ports/store-repository.port.js';
import type { ShopifyGateway, StoreConnection } from '../ports/shopify-gateway.port.js';

export const ID_1 = '11111111-1111-4111-8111-111111111111';
export const ID_2 = '22222222-2222-4222-8222-222222222222';
export const T0 = '2026-10-15T10:00:00.000Z';
export const keyring = { activeKeyId: 'k1', keys: new Map([['k1', Buffer.alloc(32, 0x21)]]) };

export const domainOf = (host: string): ShopDomain => {
  const parsed = parseShopDomain(host);
  if (!parsed.ok) throw new Error('bad test domain');
  return parsed.domain;
};

/** In-memory repository with the same observable rules as the Prisma one. */
export class InMemoryStoreRepository implements StoreRepository {
  readonly rows = new Map<string, Store>();
  writes = 0;
  reads = 0;
  constructor(private readonly nowIso: () => string = () => T0) {}

  insert(store: Store): Promise<void> {
    this.writes += 1;
    if ([...this.rows.values()].some((r) => r.shopDomain === store.shopDomain)) {
      return Promise.reject(new DuplicateShopDomainError());
    }
    this.rows.set(store.id, store);
    return Promise.resolve();
  }
  findById(id: string): Promise<Store | null> {
    this.reads += 1;
    return Promise.resolve(this.rows.get(id) ?? null);
  }
  list(): Promise<Store[]> {
    this.reads += 1;
    const sorted = [...this.rows.values()].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    );
    return Promise.resolve(sorted);
  }
  replaceCredentials(
    id: string,
    next: { readonly authKind: Store['authKind']; readonly credentialsEnvelope: string },
  ): Promise<Store | null> {
    this.writes += 1;
    const current = this.rows.get(id);
    if (current === undefined) return Promise.resolve(null);
    const updated = replaceCredentials(current, next, this.nowIso());
    this.rows.set(id, updated);
    return Promise.resolve(updated);
  }
  recordVerification(id: string, envelope: string, record: VerificationRecord): Promise<boolean> {
    const current = this.rows.get(id);
    if (current?.credentialsEnvelope !== envelope) return Promise.resolve(false);
    this.writes += 1;
    this.rows.set(id, {
      ...current,
      status: record.status,
      lastVerifiedAt: record.lastVerifiedAt,
      shopifyShopId: record.shopifyShopId ?? current.shopifyShopId,
      apiVersion: record.apiVersion,
      lastVerification: record.snapshot,
    });
    return Promise.resolve(true);
  }
  delete(id: string): Promise<boolean> {
    this.writes += 1;
    return Promise.resolve(this.rows.delete(id));
  }
}

/** A simulator that asks the credential provider for a token first, as the real client does. */
export class TokenAskingGateway implements ShopifyGateway {
  constructor(readonly inner: SimulatedShopifyGateway) {}
  async getShopInfo(c: StoreConnection) {
    await c.credentials.accessToken();
    return this.inner.getShopInfo(c);
  }
  async getGrantedScopes(c: StoreConnection) {
    await c.credentials.accessToken();
    return this.inner.getGrantedScopes(c);
  }
  async listLocations(c: StoreConnection) {
    await c.credentials.accessToken();
    return this.inner.listLocations(c);
  }
}

export interface Harness {
  readonly box: AesGcmSecretBox;
  readonly vault: StoreCredentialVault;
  readonly repository: InMemoryStoreRepository;
  readonly registry: DefaultCredentialProviderRegistry;
  readonly simulator: SimulatedShopifyGateway;
  readonly gateway: TokenAskingGateway;
  readonly clock: { nowMs: () => number };
  readonly exchanged: number[];
  /** Seals the payload and stores the row for `id`. */
  addStore(id: string, host: string, payload: CredentialsBody): Promise<Store>;
}

export function makeHarness(options: { exchange?: () => Promise<never> } = {}): Harness {
  const box = new AesGcmSecretBox(keyring);
  const vault = new StoreCredentialVault(box);
  const nowMs = Date.parse(T0);
  const clock = { nowMs: () => nowMs };
  const repository = new InMemoryStoreRepository(() => new Date(clock.nowMs()).toISOString());
  const exchanged: number[] = [];
  const registry = new DefaultCredentialProviderRegistry({
    vault,
    now: clock.nowMs,
    exchanger: {
      exchange: () => {
        exchanged.push(1);
        return (
          options.exchange?.() ??
          Promise.resolve({ accessToken: 'exchanged-token-0001', expiresAtMs: nowMs + 86_400_000 })
        );
      },
    },
  });
  const simulator = new SimulatedShopifyGateway();
  return {
    box,
    vault,
    repository,
    registry,
    simulator,
    gateway: new TokenAskingGateway(simulator),
    clock,
    exchanged,
    async addStore(id, host, payload) {
      const store = newStore(
        {
          id,
          displayName: `Shop ${id.slice(0, 2)}`,
          shopDomain: domainOf(host),
          authKind: payload.kind,
          credentialsEnvelope: vault.seal(id, payload),
        },
        T0,
      );
      await repository.insert(store);
      repository.writes = 0;
      return store;
    },
  };
}

export const healthyShop = (scopes: readonly string[]) => ({
  name: 'Demo',
  currencyCode: 'USD',
  planName: 'Basic',
  shopifyPlus: false,
  partnerDevelopment: false,
  scopes,
  locations: [
    { id: 'gid://shopify/Location/1', name: 'B', isActive: true, fulfillsOnlineOrders: true },
    { id: 'gid://shopify/Location/2', name: 'A', isActive: true, fulfillsOnlineOrders: false },
  ],
});
export const ALL_SCOPES = ['write_products', 'write_files', 'write_inventory'];
export const STATIC: CredentialsBody = {
  kind: 'static_token',
  accessToken: 'static-token-canary-0001',
};
