import { describe, expect, it } from 'vitest';
import { ApiError } from './api-error.js';

describe('ApiError', () => {
  it.each([
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
  ])('accepts code %s', (code) => {
    const body = { error: { code, message: 'Request rejected.' } };
    expect(ApiError.parse(body)).toEqual(body);
  });

  it.each([
    ['unknown code', { error: { code: 'TEAPOT', message: 'x' } }],
    ['missing message', { error: { code: 'HOST_NOT_ALLOWED' } }],
    ['missing error wrapper', { code: 'HOST_NOT_ALLOWED', message: 'x' }],
    ['null', null],
  ])('rejects %s', (_label, body) => {
    expect(ApiError.safeParse(body).success).toBe(false);
  });
});
