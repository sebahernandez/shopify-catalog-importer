import 'reflect-metadata';
import type { ArgumentsHost } from '@nestjs/common';
import { ApiError } from '@importer/contracts';
import { describe, expect, it } from 'vitest';
import { LocalRequestFilter } from './local-request.filter.js';
import { LocalRequestRejection } from './local-request-rejection.js';

interface Sent {
  status?: number;
  body?: unknown;
}

function hostWith(sent: Sent): ArgumentsHost {
  const response = {
    status(code: number) {
      sent.status = code;
      return response;
    },
    json(body: unknown) {
      sent.body = body;
      return response;
    },
  };
  return { switchToHttp: () => ({ getResponse: () => response }) } as unknown as ArgumentsHost;
}

describe('LocalRequestFilter', () => {
  it.each([
    ['HOST_NOT_ALLOWED', 'host not allowed'],
    ['ORIGIN_NOT_ALLOWED', 'origin not allowed'],
  ] as const)('answers %s with 403 and the shared ApiError body', (code, message) => {
    const sent: Sent = {};
    new LocalRequestFilter().catch(new LocalRequestRejection(code), hostWith(sent));
    expect(sent.status).toBe(403);
    expect(ApiError.parse(sent.body)).toEqual({ error: { code, message } });
  });

  it('writes exactly the code and the fixed text, and no other field', () => {
    const sent: Sent = {};
    const rejection = new LocalRequestRejection('ORIGIN_NOT_ALLOWED');
    // Fields a careless filter might copy across.
    Object.assign(rejection, { header: 'odd-seed-1c2d', stack: 'odd-seed-1c2d' });
    new LocalRequestFilter().catch(rejection, hostWith(sent));
    expect(sent.body).toEqual({
      error: { code: 'ORIGIN_NOT_ALLOWED', message: 'origin not allowed' },
    });
    expect(JSON.stringify(sent.body)).not.toContain('odd-seed-1c2d');
  });

  it('is registered for guard rejections only, so other errors keep the framework handling', () => {
    expect(Reflect.getMetadata('__filterCatchExceptions__', LocalRequestFilter)).toEqual([
      LocalRequestRejection,
    ]);
  });
});
