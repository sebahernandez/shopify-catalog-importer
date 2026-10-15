import 'reflect-metadata';
import type { ArgumentsHost } from '@nestjs/common';
import { ApiError } from '@importer/contracts';
import { describe, expect, it } from 'vitest';
import { LocalRequestRejection } from '../../../local-security/local-request-rejection.js';
import {
  StoreAlreadyExistsError,
  StoreCredentialsInvalidError,
  StoreDisplayNameInvalidError,
  StoreDomainInvalidError,
  StoreNotFoundError,
  StoreRequestInvalidError,
} from '../../application/store-errors.js';
import { StoresExceptionFilter } from './stores-exception.filter.js';

interface Sent {
  status?: number;
  body?: unknown;
  headers: Record<string, string>;
}

function hostWith(sent: Sent): ArgumentsHost {
  const response = {
    setHeader(name: string, value: string) {
      sent.headers[name] = value;
    },
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

function run(error: unknown): { sent: Sent; logged: unknown[] } {
  const sent: Sent = { headers: {} };
  const logged: unknown[] = [];
  new StoresExceptionFilter({ error: (entry: unknown) => void logged.push(entry) }).catch(
    error,
    hostWith(sent),
  );
  return { sent, logged };
}

describe('StoresExceptionFilter', () => {
  it.each([
    [new StoreNotFoundError(), 404, 'STORE_NOT_FOUND', 'Store not found.'],
    [
      new StoreDomainInvalidError('WRONG_SUFFIX'),
      400,
      'STORE_DOMAIN_INVALID',
      'The shop domain is not valid. Use the myshopify.com domain of the store.',
    ],
    [
      new StoreAlreadyExistsError(),
      409,
      'STORE_ALREADY_EXISTS',
      'A store with this domain already exists.',
    ],
    [
      new StoreCredentialsInvalidError(),
      400,
      'STORE_CREDENTIALS_INVALID',
      'The credentials are not valid.',
    ],
    [new StoreRequestInvalidError(), 400, 'STORE_REQUEST_INVALID', 'The request is not valid.'],
    [new StoreDisplayNameInvalidError(), 400, 'STORE_REQUEST_INVALID', 'The request is not valid.'],
  ])('maps %o to %i %s with the fixed text', (error, status, code, message) => {
    const { sent, logged } = run(error);
    expect(sent.status).toBe(status);
    expect(ApiError.parse(sent.body)).toEqual({ error: { code, message } });
    expect(logged).toEqual([]);
  });

  it('answers a body-parser error without its message', () => {
    const parserError = Object.assign(
      new SyntaxError('Unexpected token canary-body-9f3a in JSON'),
      {
        status: 400,
        type: 'entity.parse.failed',
        body: '{"canary-body-9f3a"',
      },
    );
    const { sent, logged } = run(parserError);
    expect(sent.status).toBe(400);
    expect(sent.body).toEqual({
      error: { code: 'STORE_REQUEST_INVALID', message: 'The request is not valid.' },
    });
    expect(JSON.stringify([sent, logged])).not.toContain('canary-body-9f3a');
  });

  it('answers any other error with the generic 500 body and logs only event and errorName', () => {
    const error = Object.assign(new TypeError('boom canary-msg-77ab'), { extra: 'canary-prop' });
    const { sent, logged } = run(error);
    expect(sent.status).toBe(500);
    expect(sent.body).toEqual({ statusCode: 500, message: 'Internal server error' });
    expect(logged).toEqual([{ event: 'store_request_failed', errorName: 'TypeError' }]);
    expect(JSON.stringify([sent, logged])).not.toMatch(/canary|stack|boom/);
  });

  it('names a thrown non-error as UnknownError', () => {
    expect(run('a string with canary-1').logged).toEqual([
      { event: 'store_request_failed', errorName: 'UnknownError' },
    ]);
  });

  it('still answers 500 when the logger itself fails', () => {
    const sent: Sent = { headers: {} };
    new StoresExceptionFilter({
      error: () => {
        throw new Error('sink down');
      },
    }).catch(new Error('x'), hostWith(sent));
    expect(sent.status).toBe(500);
  });

  it('keeps the body of a guard rejection and adds no-store to it', () => {
    const { sent } = run(new LocalRequestRejection('ORIGIN_NOT_ALLOWED'));
    expect(sent.status).toBe(403);
    expect(sent.body).toEqual({
      error: { code: 'ORIGIN_NOT_ALLOWED', message: 'origin not allowed' },
    });
    expect(sent.headers['Cache-Control']).toBe('no-store');
  });

  it('sets no-store on every kind of response', () => {
    for (const error of [
      new StoreNotFoundError(),
      new StoreAlreadyExistsError(),
      new Error('x'),
      Object.assign(new Error('p'), { status: 400, type: 'entity.parse.failed' }),
    ]) {
      expect(run(error).sent.headers['Cache-Control']).toBe('no-store');
    }
  });

  it('gives identical bodies for two different invalid domains and echoes neither', () => {
    const first = run(new StoreDomainInvalidError('WRONG_SUFFIX')).sent.body;
    const second = run(new StoreDomainInvalidError('USERINFO')).sent.body;
    expect(first).toEqual(second);
    expect(JSON.stringify(first)).not.toMatch(/evil|canary|token/i);
  });

  it('catches every exception', () => {
    expect(Reflect.getMetadata('__filterCatchExceptions__', StoresExceptionFilter)).toEqual([]);
  });
});
