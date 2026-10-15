import {
  CredentialsPayload,
  type ReplaceCredentialsBody,
  type StoreSummary,
} from '@importer/contracts';
import type { CredentialProviderRegistry } from '../ports/credential-provider-registry.port.js';
import type { CredentialVault } from '../ports/credential-vault.port.js';
import type { StoreRepository } from '../ports/store-repository.port.js';
import { StoreCredentialsInvalidError, StoreNotFoundError } from './store-errors.js';
import { isStoreId } from './store-id.js';
import { toStoreSummary } from './store-summary.js';

export interface ReplaceCredentialsDeps {
  readonly repository: StoreRepository;
  readonly vault: CredentialVault;
  readonly registry: CredentialProviderRegistry;
}

/** Offline: the store goes back to UNVERIFIED and its cached token is dropped. */
export class ReplaceCredentialsUseCase {
  constructor(private readonly deps: ReplaceCredentialsDeps) {}

  async execute(id: string, body: ReplaceCredentialsBody): Promise<StoreSummary> {
    const { repository, vault, registry } = this.deps;
    if (!isStoreId(id) || (await repository.findById(id)) === null) throw new StoreNotFoundError();
    const credentials = CredentialsPayload.safeParse(body.credentials);
    if (!credentials.success) throw new StoreCredentialsInvalidError();

    const updated = await repository.replaceCredentials(id, {
      authKind: credentials.data.kind,
      credentialsEnvelope: vault.seal(id, credentials.data),
    });
    if (updated === null) throw new StoreNotFoundError();
    registry.forget(id);
    return toStoreSummary(updated);
  }
}
