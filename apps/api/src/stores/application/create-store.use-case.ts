import { CreateStoreBody, CredentialsPayload, type StoreSummary } from '@importer/contracts';
import type { Clock } from '../../shared-kernel/time/clock.port.js';
import { parseShopDomain } from '../domain/shop-domain.js';
import { newStore } from '../domain/store-rules.js';
import type { CredentialVault } from '../ports/credential-vault.port.js';
import type { IdGenerator } from '../ports/id-generator.port.js';
import { DuplicateShopDomainError, type StoreRepository } from '../ports/store-repository.port.js';
import {
  StoreAlreadyExistsError,
  StoreCredentialsInvalidError,
  StoreDisplayNameInvalidError,
  StoreDomainInvalidError,
} from './store-errors.js';
import { toStoreSummary } from './store-summary.js';

export interface CreateStoreDeps {
  readonly repository: StoreRepository;
  readonly vault: CredentialVault;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
}

/** Registers a store offline: nothing here contacts Shopify. */
export class CreateStoreUseCase {
  constructor(private readonly deps: CreateStoreDeps) {}

  async execute(input: CreateStoreBody): Promise<StoreSummary> {
    const { repository, vault, clock, idGenerator } = this.deps;
    const name = CreateStoreBody.shape.displayName.safeParse(input.displayName);
    if (!name.success) throw new StoreDisplayNameInvalidError();
    const domain = parseShopDomain(input.domain);
    if (!domain.ok) throw new StoreDomainInvalidError(domain.reason);
    const credentials = CredentialsPayload.safeParse(input.credentials);
    if (!credentials.success) throw new StoreCredentialsInvalidError();

    const id = idGenerator.next();
    const store = newStore(
      {
        id,
        displayName: name.data,
        shopDomain: domain.domain,
        authKind: credentials.data.kind,
        credentialsEnvelope: vault.seal(id, credentials.data),
      },
      new Date(clock.nowMs()).toISOString(),
    );
    try {
      await repository.insert(store);
    } catch (error) {
      if (error instanceof DuplicateShopDomainError) throw new StoreAlreadyExistsError();
      throw error;
    }
    return toStoreSummary(store);
  }
}
