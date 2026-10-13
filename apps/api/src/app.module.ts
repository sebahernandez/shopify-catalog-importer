import { Module, type DynamicModule, type ModuleMetadata } from '@nestjs/common';
import { APP_CONFIG, ConfigModule } from './config/config.module.js';
import type { AppConfig } from './config/load-config.js';
import { LocalSecurityModule } from './local-security/local-security.module.js';
import { PersistenceModule } from './persistence/persistence.module.js';
import type { LoggerPort } from './shared-kernel/logging/logger.port.js';

export interface AppModuleOptions {
  /** The configuration `bootstrap()` already validated. The modules share this one object. */
  readonly config: AppConfig;
  /** Receives the guard's rejection warnings. */
  readonly logger: Pick<LoggerPort, 'warn'>;
  /**
   * Further modules to import. Only tests pass this (the test-only write route lives in one);
   * `main.ts` never does, and no environment variable can add one.
   */
  readonly extraModules?: NonNullable<ModuleMetadata['imports']>;
}

/**
 * The root module. S0 declares no controller here: the health route (U14) arrives through its
 * own module, and the test-only write route never reaches this class.
 *
 * `ConfigModule` is given the configuration `bootstrap()` loaded before any application existed,
 * so every module sees the same object and the environment file is read once.
 */
@Module({})
export class AppModule {
  static forRoot(options: AppModuleOptions): DynamicModule {
    const config: DynamicModule = {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG, useValue: options.config }],
      exports: [APP_CONFIG],
    };
    return {
      module: AppModule,
      imports: [
        config,
        PersistenceModule.forRoot(config),
        LocalSecurityModule.forRoot(config, { logger: options.logger }),
        ...(options.extraModules ?? []),
      ],
    };
  }
}
