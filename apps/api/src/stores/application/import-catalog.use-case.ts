import type { ImportProductResult, ImportResponse } from '@importer/contracts';
import type { ImportableProduct } from '../domain/importable-catalog.js';
import type { LoggerPort } from '../../shared-kernel/logging/logger.port.js';
import type { CredentialProviderRegistry } from '../ports/credential-provider-registry.port.js';
import { CredentialsUnreadableError } from '../ports/credentials-unreadable.error.js';
import { ShopifyGatewayError } from '../ports/shopify-gateway-error.js';
import type {
  CreateProductResult,
  Location,
  ShopifyGateway,
  StoreConnection,
} from '../ports/shopify-gateway.port.js';
import type { StoreRepository } from '../ports/store-repository.port.js';
import type { WorkbookValidator } from '../ports/workbook-validator.port.js';
import { buildProductInput, needsLocation } from './build-product-input.js';
import { failure, failureOfError, failureOfRejection } from './import-failures.js';
import { createLocationResolver } from './import-location-resolver.js';
import {
  ShopifyRequestFailedError,
  StoreNotConnectedError,
  StoreNotFoundError,
  WorkbookInvalidError,
} from './store-errors.js';
import { isStoreId } from './store-id.js';

export interface ImportCatalogDeps {
  readonly repository: StoreRepository;
  readonly registry: CredentialProviderRegistry;
  readonly gateway: ShopifyGateway;
  readonly validator: WorkbookValidator;
  /** The configured API version; the stored one is never used. */
  readonly apiVersion: string;
  readonly logger: LoggerPort;
}

type Created = Extract<CreateProductResult, { kind: 'created' }>;
type Resolver = ReturnType<typeof createLocationResolver>;

const NO_LOCATIONS: Resolver = createLocationResolver([], false);

/**
 * Imports a validated workbook into a connected store, one product per `productSet` call, in
 * workbook order. The file is validated again here; a report with errors ends the use case before
 * any credential is read or Shopify is called. A product never makes the batch throw: its failure
 * is its own result. A write is never retried; an error that affects every product (credentials,
 * throttling, an unreadable answer) stops the run and the products after it are `NOT_ATTEMPTED`.
 */
export class ImportCatalogUseCase {
  constructor(private readonly deps: ImportCatalogDeps) {}

  async execute(id: string, bytes: Uint8Array, sha256: string): Promise<ImportResponse> {
    const { repository, registry, validator, apiVersion, logger } = this.deps;
    const store = isStoreId(id) ? await repository.findById(id) : null;
    if (store === null) throw new StoreNotFoundError();
    if (store.status !== 'CONNECTED') throw new StoreNotConnectedError();

    const outcome = await validator.validate(bytes, sha256);
    if (outcome.draft === undefined) throw new WorkbookInvalidError(outcome.report);
    const { products } = outcome.draft;

    let connection: StoreConnection;
    try {
      connection = {
        storeId: store.id,
        shopDomain: store.shopDomain,
        apiVersion,
        credentials: registry.forStore(store),
      };
    } catch (error) {
      if (error instanceof CredentialsUnreadableError) throw new StoreNotConnectedError();
      throw error;
    }

    const resolve = products.some(needsLocation)
      ? await this.locationResolver(connection)
      : NO_LOCATIONS;

    const results: ImportProductResult[] = [];
    let stopped = false;
    for (const product of products) {
      if (stopped) {
        results.push(failed(product, failure('NOT_ATTEMPTED')));
        continue;
      }
      const one = await this.importOne(connection, product, resolve);
      results.push(one.result);
      stopped = one.stop;
    }
    const created = results.filter(({ status }) => status === 'created').length;
    logger.log({
      event: 'store_import_finished',
      storeId: store.id,
      status: stopped ? 'stopped' : 'completed',
    });
    return {
      totals: { products: results.length, created, failed: results.length - created },
      stoppedEarly: stopped,
      results,
    };
  }

  private async locationResolver(connection: StoreConnection): Promise<Resolver> {
    try {
      const { value } = await this.deps.gateway.listLocations(connection);
      const locations: Location[] = value.locations;
      return createLocationResolver(locations, value.truncated);
    } catch (error) {
      if (error instanceof ShopifyGatewayError) throw new ShopifyRequestFailedError();
      throw error;
    }
  }

  private async importOne(
    connection: StoreConnection,
    product: ImportableProduct,
    resolve: Resolver,
  ): Promise<{ result: ImportProductResult; stop: boolean }> {
    const built = buildProductInput(product, resolve);
    if (!built.ok) return { result: failed(product, failure(built.code)), stop: false };
    try {
      const { value } = await this.deps.gateway.createProduct(connection, built.input);
      const result =
        value.kind === 'created'
          ? createdResult(product, value, built.imagesSkipped)
          : failed(product, failureOfRejection(value.userErrors));
      return { result, stop: false };
    } catch (error) {
      const classified = failureOfError(error);
      return { result: failed(product, classified.failure), stop: classified.stop };
    }
  }
}

const failed = (
  product: ImportableProduct,
  reason: ReturnType<typeof failure>,
): ImportProductResult => ({
  productKey: product.productKey,
  handle: product.handle,
  status: 'failed',
  failure: reason,
});

const SAFE_CODE = /^[A-Za-z0-9_]{1,64}$/;

const createdResult = (
  product: ImportableProduct,
  result: Created,
  imagesSkipped: { localFile: number; overLimit: number },
): ImportProductResult => ({
  productKey: product.productKey,
  handle: product.handle,
  status: 'created',
  productId: result.product.id,
  shopifyHandle: result.product.handle,
  mediaStatuses: result.product.media.map(({ status }) => status),
  imagesSkipped,
  warnings: result.userErrors.flatMap(({ code }) =>
    code !== null && SAFE_CODE.test(code) ? [code] : [],
  ),
});
