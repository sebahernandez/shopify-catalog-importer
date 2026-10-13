import { Inject, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { LoggerPort } from '../shared-kernel/logging/logger.port.js';
import type { GuardPolicy } from './allowed-origins.js';
import { LOCAL_SECURITY_LOGGER, LOCAL_SECURITY_POLICY } from './local-security.tokens.js';
import { LocalRequestRejection } from './local-request-rejection.js';
import { requestFactsFrom, type RawRequest } from './request-facts.js';
import { evaluateRequest, type RejectionCode } from './request-policy.js';

const CHECK_NAMES: Readonly<Record<RejectionCode, string>> = {
  HOST_NOT_ALLOWED: 'host',
  ORIGIN_NOT_ALLOWED: 'origin',
};

/**
 * The global request guard (design D7). It applies the pure rules of `evaluateRequest` to a
 * request and throws a `LocalRequestRejection` when they say no. It has no bypass and no
 * allow-by-default path.
 *
 * Fail closed: anything that goes wrong while reading the configuration or the request, or a
 * request that does not come over HTTP, is a rejection. It reports the Host check, the first
 * check that could not be completed. The guard never throws anything else.
 */
@Injectable()
export class LocalRequestGuard implements CanActivate {
  constructor(
    @Inject(LOCAL_SECURITY_POLICY) private readonly policy: GuardPolicy,
    @Inject(LOCAL_SECURITY_LOGGER) private readonly logger: Pick<LoggerPort, 'warn'>,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const code = this.rejectionFor(context);
    if (code === undefined) return true;
    this.logRejection(code);
    throw new LocalRequestRejection(code);
  }

  private rejectionFor(context: ExecutionContext): RejectionCode | undefined {
    try {
      if (context.getType() !== 'http') return 'HOST_NOT_ALLOWED';
      const request = context.switchToHttp().getRequest<RawRequest>();
      const decision = evaluateRequest(this.policy, requestFactsFrom(request));
      return decision.allowed ? undefined : decision.code;
    } catch {
      return 'HOST_NOT_ALLOWED';
    }
  }

  /** Logs the name of the failed check only, never a value, and never lets logging change the outcome. */
  private logRejection(code: RejectionCode): void {
    try {
      this.logger.warn({ event: 'local_request_rejected', check: CHECK_NAMES[code] });
    } catch {
      // A failing logger must not turn a rejection into an error or an allow.
    }
  }
}
