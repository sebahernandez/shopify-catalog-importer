import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Inject,
  Param,
  Post,
  Put,
  UseFilters,
} from '@nestjs/common';
import type { StoreSummary, StoreVerification } from '@importer/contracts';
import { CreateStoreUseCase } from '../../application/create-store.use-case.js';
import { DeleteStoreUseCase } from '../../application/delete-store.use-case.js';
import { GetStoreUseCase } from '../../application/get-store.use-case.js';
import { ListStoresUseCase } from '../../application/list-stores.use-case.js';
import { ReplaceCredentialsUseCase } from '../../application/replace-credentials.use-case.js';
import { StoreNotFoundError } from '../../application/store-errors.js';
import { isStoreId } from '../../application/store-id.js';
import { VerifyStoreConnectionUseCase } from '../../application/verify-store-connection.use-case.js';
import {
  parseCreateStoreRequest,
  parseReplaceCredentialsRequest,
} from './store-request-parsing.js';
import { StoresExceptionFilter } from './stores-exception.filter.js';

/** A malformed id is answered exactly like an unknown one, before any use case runs. */
const checked = (id: string): string => {
  if (!isStoreId(id)) throw new StoreNotFoundError();
  return id;
};

/**
 * The store routes, thin adapters over the use cases. Every response carries `no-store`; errors
 * get the header from `StoresExceptionFilter`. The global request guard already covers every
 * route here (Host everywhere, Origin on the non-GET ones).
 */
@Controller('stores')
@UseFilters(StoresExceptionFilter)
export class StoresController {
  constructor(
    @Inject(CreateStoreUseCase) private readonly create: CreateStoreUseCase,
    @Inject(ListStoresUseCase) private readonly list: ListStoresUseCase,
    @Inject(GetStoreUseCase) private readonly get: GetStoreUseCase,
    @Inject(VerifyStoreConnectionUseCase) private readonly verifier: VerifyStoreConnectionUseCase,
    @Inject(ReplaceCredentialsUseCase) private readonly replacer: ReplaceCredentialsUseCase,
    @Inject(DeleteStoreUseCase) private readonly remover: DeleteStoreUseCase,
  ) {}

  @Post()
  @Header('Cache-Control', 'no-store')
  createStore(@Body() body: unknown): Promise<StoreSummary> {
    return this.create.execute(parseCreateStoreRequest(body));
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  async listStores(): Promise<{ stores: StoreSummary[] }> {
    return { stores: await this.list.execute() };
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  getStore(@Param('id') id: string): Promise<StoreSummary> {
    return this.get.execute(checked(id));
  }

  @Post(':id/verify')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  verify(@Param('id') id: string): Promise<StoreVerification> {
    return this.verifier.execute(checked(id));
  }

  @Put(':id/credentials')
  @Header('Cache-Control', 'no-store')
  replaceCredentials(@Param('id') id: string, @Body() body: unknown): Promise<StoreSummary> {
    const valid = checked(id);
    return this.replacer.execute(valid, parseReplaceCredentialsRequest(body));
  }

  @Delete(':id')
  @HttpCode(204)
  @Header('Cache-Control', 'no-store')
  async deleteStore(@Param('id') id: string): Promise<void> {
    await this.remover.execute(checked(id));
  }
}
