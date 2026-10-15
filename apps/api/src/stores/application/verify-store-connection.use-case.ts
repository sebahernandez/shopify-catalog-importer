import type { StoreVerification } from '@importer/contracts';
import type { LoggerPort } from '../../shared-kernel/logging/logger.port.js';
import type { Clock } from '../../shared-kernel/time/clock.port.js';
import { CredentialsUnreadableError } from '../ports/credentials-unreadable.error.js';
import type { CredentialProviderRegistry } from '../ports/credential-provider-registry.port.js';
import { ShopifyGatewayError } from '../ports/shopify-gateway-error.js';
import type {
  GatewayRead,
  Location,
  ShopifyGateway,
  StoreConnection,
} from '../ports/shopify-gateway.port.js';
import type { StoreRepository } from '../ports/store-repository.port.js';
import { StoreNotFoundError } from './store-errors.js';
import { isStoreId } from './store-id.js';
import {
  assembleVerification,
  toSnapshot,
  type VerificationFailure,
  type VerificationParts,
} from './verification-result.js';

export interface VerifyStoreConnectionDeps {
  readonly repository: StoreRepository;
  readonly registry: CredentialProviderRegistry;
  readonly gateway: ShopifyGateway;
  readonly clock: Clock;
  /** The configured API version; the stored one is never used. */
  readonly apiVersion: string;
  readonly logger: LoggerPort;
}

type Collected = Omit<VerificationParts, 'checkedAt' | 'requestedVersion'>;

const EMPTY: Collected = {
  shop: null,
  granted: null,
  locations: [],
  locationsTruncated: false,
  versionsUsed: [],
  failure: null,
};

/** Never throws for gateway or credential failures: they come back as typed problems (D17). */
export class VerifyStoreConnectionUseCase {
  constructor(private readonly deps: VerifyStoreConnectionDeps) {}

  async execute(id: string): Promise<StoreVerification> {
    const { repository, registry, clock, apiVersion, logger } = this.deps;
    const store = isStoreId(id) ? await repository.findById(id) : null;
    if (store === null) throw new StoreNotFoundError();

    let collected: Collected;
    try {
      const credentials = registry.forStore(store);
      collected = await this.readAll({
        storeId: store.id,
        shopDomain: store.shopDomain,
        apiVersion,
        credentials,
      });
    } catch (error) {
      if (!(error instanceof CredentialsUnreadableError)) throw error;
      collected = { ...EMPTY, failure: 'CREDENTIALS_UNREADABLE' };
    }

    const checkedAt = new Date(clock.nowMs()).toISOString();
    const { result, status } = assembleVerification({
      ...collected,
      checkedAt,
      requestedVersion: apiVersion,
    });
    const written = await repository.recordVerification(store.id, store.credentialsEnvelope, {
      status,
      lastVerifiedAt: checkedAt,
      shopifyShopId: result.shop?.id ?? null,
      apiVersion: result.apiVersion.used ?? apiVersion,
      snapshot: toSnapshot(result),
    });
    if (!written) {
      logger.warn({ event: 'store_verification_discarded', storeId: store.id, status });
    }
    return result;
  }

  /** Stops at the first failure; a `SCOPE_MISSING` on the last call keeps what was read. */
  private async readAll(connection: StoreConnection): Promise<Collected> {
    const { gateway } = this.deps;
    let first: Collected;
    try {
      const shop = await gateway.getShopInfo(connection);
      first = { ...EMPTY, shop: shop.value, versionsUsed: [shop.apiVersionUsed] };
    } catch (error) {
      return { ...EMPTY, failure: failureOf(error) };
    }
    let scopes: GatewayRead<string[]>;
    try {
      scopes = await gateway.getGrantedScopes(connection);
    } catch (error) {
      return { ...first, failure: failureOf(error) };
    }
    const withScopes: Collected = {
      ...first,
      granted: scopes.value,
      versionsUsed: [...first.versionsUsed, scopes.apiVersionUsed],
    };
    try {
      const read = await gateway.listLocations(connection);
      const locations: Location[] = read.value.locations;
      return {
        ...withScopes,
        locations,
        locationsTruncated: read.value.truncated,
        versionsUsed: [...withScopes.versionsUsed, read.apiVersionUsed],
      };
    } catch (error) {
      return { ...withScopes, failure: failureOf(error, true) };
    }
  }
}

function failureOf(error: unknown, onLocations = false): VerificationFailure {
  if (!(error instanceof ShopifyGatewayError)) throw error;
  return {
    kind: error.kind,
    ...(error.reason === undefined ? {} : { reason: error.reason }),
    ...(onLocations ? { onLocations } : {}),
  };
}
