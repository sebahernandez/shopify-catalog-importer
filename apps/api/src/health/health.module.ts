import { Module, type DynamicModule } from '@nestjs/common';
import { HealthController } from './health.controller.js';

/**
 * Declares the health route. The caller passes the `ConfigModule` and `PersistenceModule`
 * dynamic modules it already imports, so the route sees the same configuration and the same
 * database service as the rest of the application. The module provides nothing of its own.
 */
@Module({})
export class HealthModule {
  static forRoot(config: DynamicModule, persistence: DynamicModule): DynamicModule {
    return {
      module: HealthModule,
      imports: [config, persistence],
      controllers: [HealthController],
    };
  }
}
