import { Module, type DynamicModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/load-config.js';
import type { LoggerPort } from '../shared-kernel/logging/logger.port.js';
import { buildGuardPolicy } from './allowed-origins.js';
import { LocalRequestFilter } from './local-request.filter.js';
import { LocalRequestGuard } from './local-request.guard.js';
import { LOCAL_SECURITY_LOGGER, LOCAL_SECURITY_POLICY } from './local-security.tokens.js';

export interface LocalSecurityOptions {
  /** Receives one `warn` event per rejection, with the check name only. Defaults to silent. */
  readonly logger?: Pick<LoggerPort, 'warn'>;
}

const SILENT: Pick<LoggerPort, 'warn'> = { warn: () => undefined };

/**
 * Registers the local request guard and its exception filter globally. The caller passes the
 * `ConfigModule.forRoot(...)` it already imports, so the allow-lists come from the same validated
 * configuration as everything else. Building the policy throws on a configuration it cannot
 * trust, which stops the application before it listens.
 *
 * The module declares no controller. It does not enable, register or look for any route.
 */
@Module({})
export class LocalSecurityModule {
  static forRoot(config: DynamicModule, options: LocalSecurityOptions = {}): DynamicModule {
    return {
      module: LocalSecurityModule,
      imports: [config],
      providers: [
        {
          provide: LOCAL_SECURITY_POLICY,
          inject: [APP_CONFIG],
          useFactory: (appConfig: AppConfig) =>
            buildGuardPolicy({
              apiHost: appConfig.apiHost,
              apiPort: appConfig.apiPort,
              allowedOrigins: appConfig.allowedOrigins,
            }),
        },
        { provide: LOCAL_SECURITY_LOGGER, useValue: options.logger ?? SILENT },
        { provide: APP_GUARD, useClass: LocalRequestGuard },
        { provide: APP_FILTER, useClass: LocalRequestFilter },
      ],
    };
  }
}
