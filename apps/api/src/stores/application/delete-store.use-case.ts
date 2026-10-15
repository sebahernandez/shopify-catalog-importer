import type { CredentialProviderRegistry } from '../ports/credential-provider-registry.port.js';
import type { StoreRepository } from '../ports/store-repository.port.js';
import { StoreNotFoundError } from './store-errors.js';
import { isStoreId } from './store-id.js';

export interface DeleteStoreDeps {
  readonly repository: StoreRepository;
  readonly registry: CredentialProviderRegistry;
}

/** Hard delete: the row (and with it the sealed envelope) goes, then the cached token. */
export class DeleteStoreUseCase {
  constructor(private readonly deps: DeleteStoreDeps) {}

  async execute(id: string): Promise<void> {
    const { repository, registry } = this.deps;
    if (!isStoreId(id) || !(await repository.delete(id))) throw new StoreNotFoundError();
    registry.forget(id);
  }
}
