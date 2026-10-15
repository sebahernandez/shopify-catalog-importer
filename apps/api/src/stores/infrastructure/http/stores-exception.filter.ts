import { Catch, Inject, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { ApiError } from '@importer/contracts';
import { UploadRejection } from '../../../catalog-workbook/infrastructure/http/bounded-body-reader.js';
import { LocalRequestFilter } from '../../../local-security/local-request.filter.js';
import { LocalRequestRejection } from '../../../local-security/local-request-rejection.js';
import type { LoggerPort } from '../../../shared-kernel/logging/logger.port.js';
import {
  StoreAlreadyExistsError,
  StoreCredentialsInvalidError,
  StoreDisplayNameInvalidError,
  StoreDomainInvalidError,
  ShopifyRequestFailedError,
  StoreNotConnectedError,
  StoreNotFoundError,
  StoreRequestInvalidError,
  WorkbookInvalidError,
} from '../../application/store-errors.js';
import { STORES_LOGGER } from '../../application/stores.tokens.js';

/** The response members used; Express provides all of them. */
interface ReplyLike {
  setHeader(name: string, value: string): unknown;
  status(code: number): { json(body: unknown): unknown };
}

type ApiErrorCode = ApiError['error']['code'];

/** Fixed messages (spec store-endpoints): nothing from the request is ever echoed. */
const MAPPED: readonly { status: number; code: ApiErrorCode; message: string }[] = [
  { status: 404, code: 'STORE_NOT_FOUND', message: 'Store not found.' },
  {
    status: 400,
    code: 'STORE_DOMAIN_INVALID',
    message: 'The shop domain is not valid. Use the myshopify.com domain of the store.',
  },
  {
    status: 409,
    code: 'STORE_ALREADY_EXISTS',
    message: 'A store with this domain already exists.',
  },
  { status: 400, code: 'STORE_CREDENTIALS_INVALID', message: 'The credentials are not valid.' },
  { status: 400, code: 'STORE_REQUEST_INVALID', message: 'The request is not valid.' },
  { status: 409, code: 'STORE_NOT_CONNECTED', message: 'The store is not connected.' },
  {
    status: 422,
    code: 'WORKBOOK_INVALID',
    message: 'The workbook has errors. Nothing was sent to Shopify.',
  },
  {
    status: 502,
    code: 'SHOPIFY_REQUEST_FAILED',
    message: 'Shopify could not be reached. Nothing was created.',
  },
];
const byCode = (code: ApiErrorCode) => MAPPED.find((entry) => entry.code === code)!;

const codeOf = (error: unknown): ApiErrorCode | undefined => {
  if (error instanceof StoreNotFoundError) return 'STORE_NOT_FOUND';
  if (error instanceof StoreDomainInvalidError) return 'STORE_DOMAIN_INVALID';
  if (error instanceof StoreAlreadyExistsError) return 'STORE_ALREADY_EXISTS';
  if (error instanceof StoreCredentialsInvalidError) return 'STORE_CREDENTIALS_INVALID';
  if (error instanceof StoreRequestInvalidError || error instanceof StoreDisplayNameInvalidError) {
    return 'STORE_REQUEST_INVALID';
  }
  if (error instanceof StoreNotConnectedError) return 'STORE_NOT_CONNECTED';
  if (error instanceof WorkbookInvalidError) return 'WORKBOOK_INVALID';
  if (error instanceof ShopifyRequestFailedError) return 'SHOPIFY_REQUEST_FAILED';
  return undefined;
};

/** The error `body-parser` raises for malformed JSON (status 400); its message can quote the body. */
const isBodyParserError = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { type?: unknown }).type === 'entity.parse.failed' &&
  (error as { status?: unknown }).status === 400;

const errorNameOf = (error: unknown): string =>
  error instanceof Error && typeof error.name === 'string' && error.name !== ''
    ? error.name
    : 'UnknownError';

/**
 * Controller-scoped, catches everything (design D20). Typed store errors become the shared
 * `ApiError` body; guard rejections keep their own body; anything else answers the generic 500
 * body of the framework with no message and no stack, and logs only the event and the error name,
 * because a Prisma or undici message might carry data. Every response is `no-store`.
 */
@Catch()
export class StoresExceptionFilter implements ExceptionFilter {
  constructor(@Inject(STORES_LOGGER) private readonly logger: Pick<LoggerPort, 'error'>) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<ReplyLike>();
    reply.setHeader('Cache-Control', 'no-store');
    if (error instanceof LocalRequestRejection) {
      // A controller filter shadows the global one, so the guard's 403 is delegated.
      new LocalRequestFilter().catch(error, host);
      return;
    }
    if (error instanceof UploadRejection) {
      // The upload rejection carries a fixed message per code (workbook upload contract).
      if (error.closeConnection) reply.setHeader('Connection', 'close');
      const body: ApiError = { error: { code: error.code, message: error.message } };
      reply.status(error.status).json(body);
      return;
    }
    if (error instanceof WorkbookInvalidError) {
      const { status, message } = byCode('WORKBOOK_INVALID');
      reply
        .status(status)
        .json({ error: { code: 'WORKBOOK_INVALID', message }, report: error.report });
      return;
    }
    const code = codeOf(error) ?? (isBodyParserError(error) ? 'STORE_REQUEST_INVALID' : undefined);
    if (code !== undefined) {
      const { status, message } = byCode(code);
      const body: ApiError = { error: { code, message } };
      reply.status(status).json(body);
      return;
    }
    try {
      this.logger.error({ event: 'store_request_failed', errorName: errorNameOf(error) });
    } catch {
      // A failing logger must not change the answer.
    }
    reply.status(500).json({ statusCode: 500, message: 'Internal server error' });
  }
}
