import { Module, type DynamicModule } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/load-config.js';
import { PRISMA_SERVICE } from '../persistence/persistence.module.js';
import type { PrismaService } from '../persistence/prisma.service.js';
import type { LoggerPort } from '../shared-kernel/logging/logger.port.js';
import type { SecretBox } from '../shared-kernel/secret-box/secret-box.port.js';
import { SystemClock } from '../shared-kernel/time/system-clock.js';
import type { Clock } from '../shared-kernel/time/clock.port.js';
import { CreateStoreUseCase } from './application/create-store.use-case.js';
import { ValidateWorkbookUseCase } from '../catalog-workbook/application/validate-workbook.use-case.js';
import { DeleteStoreUseCase } from './application/delete-store.use-case.js';
import { GetStoreUseCase } from './application/get-store.use-case.js';
import { ImportCatalogUseCase } from './application/import-catalog.use-case.js';
import { ListStoresUseCase } from './application/list-stores.use-case.js';
import { ReplaceCredentialsUseCase } from './application/replace-credentials.use-case.js';
import {
  CREDENTIAL_PROVIDER_REGISTRY,
  CREDENTIAL_VAULT,
  ID_GENERATOR,
  SHOPIFY_GATEWAY,
  STORES_CLOCK,
  STORES_FETCH,
  STORES_LOGGER,
  STORES_SECRET_BOX,
  STORE_REPOSITORY,
  WORKBOOK_VALIDATOR,
} from './application/stores.tokens.js';
import { VerifyStoreConnectionUseCase } from './application/verify-store-connection.use-case.js';
import { createClientCredentialsExchanger } from './infrastructure/credentials/client-credentials-exchanger.js';
import { DefaultCredentialProviderRegistry } from './infrastructure/credentials/default-credential-provider-registry.js';
import { StoreCredentialVault } from './infrastructure/credentials/store-credential-vault.js';
import { createHttpShopifyGateway } from './infrastructure/gateway/http-shopify-gateway.js';
import { createShopifyGraphqlClient } from './infrastructure/gateway/shopify-graphql-client.js';
import { createShopifyHttpTransport } from './infrastructure/gateway/shopify-http-transport.js';
import { StoresController } from './infrastructure/http/stores.controller.js';
import { StoresExceptionFilter } from './infrastructure/http/stores-exception.filter.js';
import { PrismaStoreRepository } from './infrastructure/persistence/prisma-store-repository.js';
import { RandomUuidIdGenerator } from './infrastructure/random-uuid-id-generator.js';
import type { CredentialProviderRegistry } from './ports/credential-provider-registry.port.js';
import type { CredentialVault } from './ports/credential-vault.port.js';
import type { IdGenerator } from './ports/id-generator.port.js';
import type { ShopifyGateway } from './ports/shopify-gateway.port.js';
import type { StoreRepository } from './ports/store-repository.port.js';
import type { WorkbookValidator } from './ports/workbook-validator.port.js';

/** The `fetch` shape the transport needs. */
export type StoresFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Test-only seams; production never passes them. */
export interface StoresOverrides {
  /** Replaces the HTTP gateway (for example with the simulator). */
  readonly gateway?: ShopifyGateway;
  /** Replaces the `fetch` function the HTTP adapter and the token exchange use. */
  readonly fetchFn?: StoresFetch;
  /** Replaces the retry and throttle wait of the HTTP adapter, so tests need no real delay. */
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface StoresModuleOptions {
  /** The holder `bootstrap()` binds after the key is reconciled. */
  readonly secretBox: SecretBox;
  readonly logger: LoggerPort;
  readonly overrides?: StoresOverrides;
}

/** The one place the global `fetch` is referenced: the default of the injected function. */
const defaultFetch: StoresFetch = (url, init) => globalThis.fetch(url, init);

/**
 * Wires the stores module (design D1, D4, D8): the repository over the shared Prisma service, the
 * vault over the injected box, the credential registry, the gateway and the seven use cases. It
 * reads no environment: the API version comes from the validated configuration the caller passes.
 */
@Module({})
export class StoresModule {
  static forRoot(
    config: DynamicModule,
    persistence: DynamicModule,
    workbook: DynamicModule,
    options: StoresModuleOptions,
  ): DynamicModule {
    const fetchFn = options.overrides?.fetchFn ?? defaultFetch;
    return {
      module: StoresModule,
      imports: [config, persistence, workbook],
      controllers: [StoresController],
      providers: [
        { provide: STORES_SECRET_BOX, useValue: options.secretBox },
        { provide: STORES_LOGGER, useValue: options.logger },
        { provide: STORES_FETCH, useValue: fetchFn },
        { provide: STORES_CLOCK, useFactory: (): Clock => new SystemClock() },
        { provide: ID_GENERATOR, useFactory: (): IdGenerator => new RandomUuidIdGenerator() },
        StoresExceptionFilter,
        {
          provide: STORE_REPOSITORY,
          inject: [PRISMA_SERVICE, STORES_CLOCK, STORES_LOGGER],
          useFactory: (prisma: PrismaService, clock: Clock, logger: LoggerPort): StoreRepository =>
            new PrismaStoreRepository(prisma, clock, logger),
        },
        {
          provide: CREDENTIAL_VAULT,
          inject: [STORES_SECRET_BOX],
          useFactory: (box: SecretBox): CredentialVault => new StoreCredentialVault(box),
        },
        {
          provide: CREDENTIAL_PROVIDER_REGISTRY,
          inject: [CREDENTIAL_VAULT, STORES_FETCH, STORES_CLOCK],
          useFactory: (
            vault: CredentialVault,
            fetchFunction: StoresFetch,
            clock: Clock,
          ): CredentialProviderRegistry =>
            new DefaultCredentialProviderRegistry({
              vault,
              now: () => clock.nowMs(),
              exchanger: createClientCredentialsExchanger({
                transport: createShopifyHttpTransport({ fetchFn: fetchFunction }),
                now: () => clock.nowMs(),
              }),
            }),
        },
        {
          provide: SHOPIFY_GATEWAY,
          inject: [STORES_FETCH],
          useFactory: (fetchFunction: StoresFetch): ShopifyGateway =>
            options.overrides?.gateway ??
            createHttpShopifyGateway(
              createShopifyGraphqlClient({
                fetchFn: fetchFunction,
                ...(options.overrides?.sleep !== undefined && { sleep: options.overrides.sleep }),
              }),
            ),
        },
        {
          provide: CreateStoreUseCase,
          inject: [STORE_REPOSITORY, CREDENTIAL_VAULT, STORES_CLOCK, ID_GENERATOR],
          useFactory: (
            repository: StoreRepository,
            vault: CredentialVault,
            clock: Clock,
            idGenerator: IdGenerator,
          ) => new CreateStoreUseCase({ repository, vault, clock, idGenerator }),
        },
        {
          provide: ListStoresUseCase,
          inject: [STORE_REPOSITORY],
          useFactory: (repository: StoreRepository) => new ListStoresUseCase({ repository }),
        },
        {
          provide: GetStoreUseCase,
          inject: [STORE_REPOSITORY],
          useFactory: (repository: StoreRepository) => new GetStoreUseCase({ repository }),
        },
        {
          provide: VerifyStoreConnectionUseCase,
          inject: [
            STORE_REPOSITORY,
            CREDENTIAL_PROVIDER_REGISTRY,
            SHOPIFY_GATEWAY,
            STORES_CLOCK,
            APP_CONFIG,
            STORES_LOGGER,
          ],
          useFactory: (
            repository: StoreRepository,
            registry: CredentialProviderRegistry,
            gateway: ShopifyGateway,
            clock: Clock,
            appConfig: AppConfig,
            logger: LoggerPort,
          ) =>
            new VerifyStoreConnectionUseCase({
              repository,
              registry,
              gateway,
              clock,
              apiVersion: appConfig.shopifyApiVersion,
              logger,
            }),
        },
        {
          provide: ReplaceCredentialsUseCase,
          inject: [STORE_REPOSITORY, CREDENTIAL_VAULT, CREDENTIAL_PROVIDER_REGISTRY],
          useFactory: (
            repository: StoreRepository,
            vault: CredentialVault,
            registry: CredentialProviderRegistry,
          ) => new ReplaceCredentialsUseCase({ repository, vault, registry }),
        },
        {
          provide: WORKBOOK_VALIDATOR,
          inject: [ValidateWorkbookUseCase],
          useFactory: (validate: ValidateWorkbookUseCase): WorkbookValidator => ({
            validate: (bytes, sha256) => validate.execute(bytes, sha256),
          }),
        },
        {
          provide: ImportCatalogUseCase,
          inject: [
            STORE_REPOSITORY,
            CREDENTIAL_PROVIDER_REGISTRY,
            SHOPIFY_GATEWAY,
            WORKBOOK_VALIDATOR,
            APP_CONFIG,
            STORES_LOGGER,
          ],
          useFactory: (
            repository: StoreRepository,
            registry: CredentialProviderRegistry,
            gateway: ShopifyGateway,
            validator: WorkbookValidator,
            appConfig: AppConfig,
            logger: LoggerPort,
          ) =>
            new ImportCatalogUseCase({
              repository,
              registry,
              gateway,
              validator,
              apiVersion: appConfig.shopifyApiVersion,
              logger,
            }),
        },
        {
          provide: DeleteStoreUseCase,
          inject: [STORE_REPOSITORY, CREDENTIAL_PROVIDER_REGISTRY],
          useFactory: (repository: StoreRepository, registry: CredentialProviderRegistry) =>
            new DeleteStoreUseCase({ repository, registry }),
        },
      ],
    };
  }
}
