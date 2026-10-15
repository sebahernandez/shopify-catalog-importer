import type { StoreSummary } from '@importer/contracts';
import type { StoreRepository } from '../ports/store-repository.port.js';
import { toStoreSummary } from './store-summary.js';

/** Read only: oldest first, summaries never carry credentials. */
export class ListStoresUseCase {
  constructor(private readonly deps: { readonly repository: StoreRepository }) {}

  async execute(): Promise<StoreSummary[]> {
    return (await this.deps.repository.list()).map(toStoreSummary);
  }
}
