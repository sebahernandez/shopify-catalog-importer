import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { DynamicModule, Provider } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ConfigModule } from '../config/config.module.js';
import { PersistenceModule } from '../persistence/persistence.module.js';
import { RedactingLogger } from '../shared-kernel/logging/redacting-logger.js';
import { DeferredSecretBox } from '../shared-kernel/secret-box/deferred-secret-box.js';
import { CreateStoreUseCase } from './application/create-store.use-case.js';
import { DeleteStoreUseCase } from './application/delete-store.use-case.js';
import { GetStoreUseCase } from './application/get-store.use-case.js';
import { ListStoresUseCase } from './application/list-stores.use-case.js';
import { ReplaceCredentialsUseCase } from './application/replace-credentials.use-case.js';
import { SHOPIFY_GATEWAY, STORES_FETCH, STORES_SECRET_BOX } from './application/stores.tokens.js';
import { VerifyStoreConnectionUseCase } from './application/verify-store-connection.use-case.js';
import { StoresController } from './infrastructure/http/stores.controller.js';
import { SimulatedShopifyGateway } from './infrastructure/simulator/simulated-shopify-gateway.js';
import { StoresModule } from './stores.module.js';

const config = ConfigModule.forRoot({ env: {} });
const persistence = PersistenceModule.forRoot(config);
const logger = new RedactingLogger({ sink: () => undefined });

const providerOf = (dynamic: DynamicModule, token: unknown): Provider | undefined =>
  (dynamic.providers ?? []).find(
    (provider) =>
      typeof provider === 'object' && 'provide' in provider && provider.provide === token,
  );
const factoryOf = (provider: Provider | undefined): (() => unknown) =>
  (provider as unknown as { useFactory: () => unknown }).useFactory;

describe('StoresModule.forRoot', () => {
  it('registers the controller and the six use cases', () => {
    const dynamic = StoresModule.forRoot(config, persistence, {
      secretBox: new DeferredSecretBox(),
      logger,
    });
    expect(dynamic.controllers).toEqual([StoresController]);
    for (const useCase of [
      CreateStoreUseCase,
      ListStoresUseCase,
      GetStoreUseCase,
      VerifyStoreConnectionUseCase,
      ReplaceCredentialsUseCase,
      DeleteStoreUseCase,
    ]) {
      expect(providerOf(dynamic, useCase), useCase.name).toBeDefined();
    }
  });

  it('provides the given box itself as a value', () => {
    const secretBox = new DeferredSecretBox();
    const provider = providerOf(
      StoresModule.forRoot(config, persistence, { secretBox, logger }),
      STORES_SECRET_BOX,
    );
    expect((provider as { useValue: unknown }).useValue).toBe(secretBox);
  });

  it('defaults to the HTTP gateway and the global fetch', () => {
    const dynamic = StoresModule.forRoot(config, persistence, {
      secretBox: new DeferredSecretBox(),
      logger,
    });
    const fetchFn = (providerOf(dynamic, STORES_FETCH) as { useValue: unknown }).useValue;
    expect(typeof fetchFn).toBe('function');
    const gateway = factoryOf(providerOf(dynamic, SHOPIFY_GATEWAY)) as (f: unknown) => object;
    expect(gateway(fetchFn)).not.toBeInstanceOf(SimulatedShopifyGateway);
    expect(Object.keys(gateway(fetchFn)).sort()).toEqual([
      'getGrantedScopes',
      'getShopInfo',
      'listLocations',
    ]);
  });

  it('lets an override replace the gateway and the fetch function', () => {
    const simulator = new SimulatedShopifyGateway();
    const fetchFn = () => Promise.reject(new Error('no network'));
    const dynamic = StoresModule.forRoot(config, persistence, {
      secretBox: new DeferredSecretBox(),
      logger,
      overrides: { gateway: simulator, fetchFn },
    });
    expect((providerOf(dynamic, STORES_FETCH) as { useValue: unknown }).useValue).toBe(fetchFn);
    expect(factoryOf(providerOf(dynamic, SHOPIFY_GATEWAY))()).toBe(simulator);
  });

  it('reads no environment', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./stores.module.ts', import.meta.url)),
      'utf8',
    );
    expect(source).not.toMatch(/process\.env|import\.meta\.env/);
  });
});
