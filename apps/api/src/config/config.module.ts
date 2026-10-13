import { Module, type DynamicModule } from '@nestjs/common';
import { loadConfig, type LoadConfigOptions } from './load-config.js';

/** Injection token for the validated configuration. Use `@Inject(APP_CONFIG)` explicitly. */
export const APP_CONFIG = Symbol('APP_CONFIG');

/**
 * Loads the configuration once, when the module is built, and exports it under `APP_CONFIG`. A
 * configuration error therefore stops the module graph before anything else starts. The options
 * exist for tests; production calls `ConfigModule.forRoot()` and reads the real environment.
 */
@Module({})
export class ConfigModule {
  static forRoot(options: LoadConfigOptions = {}): DynamicModule {
    return {
      module: ConfigModule,
      providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig(options) }],
      exports: [APP_CONFIG],
    };
  }
}
