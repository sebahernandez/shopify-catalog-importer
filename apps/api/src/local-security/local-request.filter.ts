import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { ApiError } from '@importer/contracts';
import { LocalRequestRejection } from './local-request-rejection.js';

/** The two response members used; Express provides both. */
interface JsonResponse {
  status(code: number): { json(body: unknown): unknown };
}

/**
 * Turns a guard rejection into the shared `ApiError` body. It handles rejections only: any other
 * exception keeps the framework's own handling, which answers an unexpected error with a generic
 * 500 and no message or stack. `ApiError` has no code for such a failure, so this filter does
 * not invent one.
 */
@Catch(LocalRequestRejection)
export class LocalRequestFilter implements ExceptionFilter<LocalRequestRejection> {
  catch(rejection: LocalRequestRejection, host: ArgumentsHost): void {
    const body: ApiError = { error: { code: rejection.code, message: rejection.message } };
    host.switchToHttp().getResponse<JsonResponse>().status(rejection.status).json(body);
  }
}
