import type { HealthResponse } from '@importer/contracts';
import { Controller, Get, Inject, Res } from '@nestjs/common';
import { APP_CONFIG } from '../config/config.module.js';
import type { AppConfig } from '../config/load-config.js';
import { PRISMA_SERVICE } from '../persistence/persistence.module.js';
import type { PrismaService } from '../persistence/prisma.service.js';
import { reportHealth } from './health-report.js';

/** The one response member used; Express provides it. */
interface StatusSetter {
  status(code: number): unknown;
}

/**
 * `GET /health`, at the application root (the global prefix excludes it). A thin adapter: the
 * decision lives in `reportHealth`, the check is `PrismaService.isReachable()`, and the version is
 * the pinned one from the validated configuration. The route only reads: it opens no connection of
 * its own and writes nothing.
 */
@Controller('health')
export class HealthController {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Get()
  async check(@Res({ passthrough: true }) response: StatusSetter): Promise<HealthResponse> {
    const { statusCode, body } = await reportHealth(
      () => this.prisma.isReachable(),
      this.config.shopifyApiVersion,
    );
    response.status(statusCode);
    return body;
  }
}
