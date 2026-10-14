import { Catch, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { ApiError } from '@importer/contracts';
import { UploadRejection } from './bounded-body-reader.js';

/** The two response members used; Express provides both. */
interface ReplyLike {
  setHeader(name: string, value: string): unknown;
  status(code: number): { json(body: unknown): unknown };
}

/**
 * Turns a request error of the validate route (400, 413, 415) into the shared `ApiError` body. It
 * handles upload rejections only: any other exception keeps the framework's generic 500.
 */
@Catch(UploadRejection)
export class WorkbookExceptionFilter implements ExceptionFilter<UploadRejection> {
  catch(rejection: UploadRejection, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<ReplyLike>();
    if (rejection.closeConnection) reply.setHeader('Connection', 'close');
    const body: ApiError = { error: { code: rejection.code, message: rejection.message } };
    reply.status(rejection.status).json(body);
  }
}
