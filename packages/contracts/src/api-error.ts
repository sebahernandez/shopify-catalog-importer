import { z } from 'zod';

/** Error body returned for a request the API rejects (local request guard, workbook upload). */
export const ApiError = z.object({
  error: z.object({
    code: z.enum([
      'HOST_NOT_ALLOWED',
      'ORIGIN_NOT_ALLOWED',
      'WORKBOOK_FILE_REQUIRED',
      'WORKBOOK_TOO_LARGE',
      'WORKBOOK_UNSUPPORTED_MEDIA_TYPE',
      'STORE_NOT_FOUND',
      'STORE_DOMAIN_INVALID',
      'STORE_ALREADY_EXISTS',
      'STORE_CREDENTIALS_INVALID',
      'STORE_REQUEST_INVALID',
      'STORE_NOT_CONNECTED',
      'WORKBOOK_INVALID',
      'SHOPIFY_REQUEST_FAILED',
    ]),
    message: z.string(),
  }),
});

export type ApiError = z.infer<typeof ApiError>;
