import { Inject, Module, type DynamicModule, type OnApplicationShutdown } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/load-config.js';
import { PrismaKeyCheckStore } from './prisma-key-check-store.js';
import { PrismaService } from './prisma.service.js';

/** Injection token for the `PrismaService`. Use `@Inject(PRISMA_SERVICE)` explicitly. */
export const PRISMA_SERVICE = Symbol('PRISMA_SERVICE');

/** Injection token for the kernel's `KeyCheckStore` port. */
export const KEY_CHECK_STORE = Symbol('KEY_CHECK_STORE');

/**
 * Provides the `PrismaService` built from the validated configuration and disconnects it when the
 * application shuts down. Building the module does not connect: the ordered boot calls
 * `connect()` at the right step, so a database problem cannot be hidden in module initialisation.
 *
 * The caller passes the `ConfigModule.forRoot(...)` it already imports, so the configuration is
 * the same object everywhere.
 */
@Module({})
export class PersistenceModule implements OnApplicationShutdown {
  constructor(@Inject(PRISMA_SERVICE) private readonly prisma: PrismaService) {}

  static forRoot(config: DynamicModule): DynamicModule {
    return {
      module: PersistenceModule,
      imports: [config],
      providers: [
        {
          provide: PRISMA_SERVICE,
          inject: [APP_CONFIG],
          useFactory: (appConfig: AppConfig) =>
            new PrismaService({
              dataDir: appConfig.dataDir,
              busyTimeoutMs: appConfig.sqliteBusyTimeoutMs,
            }),
        },
        {
          provide: KEY_CHECK_STORE,
          inject: [PRISMA_SERVICE],
          useFactory: (prisma: PrismaService) => new PrismaKeyCheckStore(prisma),
        },
      ],
      exports: [PRISMA_SERVICE, KEY_CHECK_STORE],
    };
  }

  async onApplicationShutdown(): Promise<void> {
    await this.prisma.disconnect();
  }
}
