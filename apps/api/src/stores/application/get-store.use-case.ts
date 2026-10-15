import type { StoreSummary } from '@importer/contracts';
import type { StoreRepository } from '../ports/store-repository.port.js';
import { StoreNotFoundError } from './store-errors.js';
import { isStoreId } from './store-id.js';
import { toStoreSummary } from './store-summary.js';

/** Read only: a malformed id is answered like an unknown one without reaching the repository. */
export class GetStoreUseCase {
  constructor(private readonly deps: { readonly repository: StoreRepository }) {}

  async execute(id: string): Promise<StoreSummary> {
    const store = isStoreId(id) ? await this.deps.repository.findById(id) : null;
    if (store === null) throw new StoreNotFoundError();
    return toStoreSummary(store);
  }
}
