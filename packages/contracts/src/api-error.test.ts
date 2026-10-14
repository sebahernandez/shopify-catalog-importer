import { describe, expect, it } from 'vitest';
import { ApiError } from './api-error.js';

describe('ApiError', () => {
  it.each([
    'HOST_NOT_ALLOWED',
    'ORIGIN_NOT_ALLOWED',
    'WORKBOOK_FILE_REQUIRED',
    'WORKBOOK_TOO_LARGE',
    'WORKBOOK_UNSUPPORTED_MEDIA_TYPE',
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
