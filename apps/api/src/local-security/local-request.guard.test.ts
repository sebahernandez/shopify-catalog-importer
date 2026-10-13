import 'reflect-metadata';
import type { ExecutionContext } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { buildGuardPolicy, type GuardPolicy } from './allowed-origins.js';
import { LocalRequestGuard } from './local-request.guard.js';
import { LocalRequestRejection } from './local-request-rejection.js';

const policy = buildGuardPolicy({
  apiHost: '127.0.0.1',
  apiPort: 3000,
  allowedOrigins: ['http://127.0.0.1:5173', 'http://localhost:5173'],
});

// A seeded odd value: it must never come back out of the guard, in any form.
const SEED = 'odd-seed-9f3a.example';

interface Sent {
  method?: string;
  host?: string;
  origin?: string;
  secFetchSite?: string;
}

function contextFor(request: unknown, type = 'http'): ExecutionContext {
  return {
    getType: () => type,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function requestWith({ method = 'POST', host = '127.0.0.1:3000', ...rest }: Sent = {}): unknown {
  const rawHeaders = ['Host', host];
  if (rest.origin !== undefined) rawHeaders.push('Origin', rest.origin);
  if (rest.secFetchSite !== undefined) rawHeaders.push('Sec-Fetch-Site', rest.secFetchSite);
  return { method, rawHeaders };
}

function warnings(): { events: unknown[][]; logger: { warn: (...args: unknown[]) => void } } {
  const events: unknown[][] = [];
  return { events, logger: { warn: (...args) => void events.push(args) } };
}

function rejectionOf(guard: LocalRequestGuard, context: ExecutionContext): LocalRequestRejection {
  try {
    guard.canActivate(context);
  } catch (error) {
    expect(error).toBeInstanceOf(LocalRequestRejection);
    return error as LocalRequestRejection;
  }
  throw new Error('the guard allowed the request');
}

describe('LocalRequestGuard', () => {
  it('allows a request the rules allow, and logs nothing', () => {
    const { events, logger } = warnings();
    const guard = new LocalRequestGuard(policy, logger);
    expect(guard.canActivate(contextFor(requestWith({ origin: 'http://localhost:5173' })))).toBe(
      true,
    );
    expect(guard.canActivate(contextFor(requestWith({ method: 'GET', origin: SEED })))).toBe(true);
    expect(events).toEqual([]);
  });

  it.each([
    ['a foreign Host', { host: SEED }, 403, 'HOST_NOT_ALLOWED', 'host not allowed'],
    ['a foreign Origin', { origin: SEED }, 403, 'ORIGIN_NOT_ALLOWED', 'origin not allowed'],
    [
      'a cross-site request with no Origin',
      { secFetchSite: 'cross-site' },
      403,
      'ORIGIN_NOT_ALLOWED',
      'origin not allowed',
    ],
  ] as const)('rejects %s with a fixed code and text', (_label, sent, status, code, message) => {
    const rejection = rejectionOf(
      new LocalRequestGuard(policy, warnings().logger),
      contextFor(requestWith(sent)),
    );
    expect({ status: rejection.status, code: rejection.code, message: rejection.message }).toEqual({
      status,
      code,
      message,
    });
  });

  it('never carries a request value in the rejection, its text, its fields or its stack', () => {
    for (const sent of [{ host: SEED }, { origin: SEED }, { secFetchSite: SEED }]) {
      const rejection = rejectionOf(
        new LocalRequestGuard(policy, warnings().logger),
        contextFor(requestWith(sent)),
      );
      const everything = [
        rejection.message,
        rejection.stack,
        JSON.stringify(rejection),
        String(rejection),
        Object.getOwnPropertyNames(rejection).join(),
      ].join('\n');
      expect(everything).not.toContain(SEED);
    }
  });

  describe('fails closed', () => {
    const unreadablePolicy: GuardPolicy = {
      get allowedHosts(): ReadonlySet<string> {
        throw new Error(`configuration unreadable ${SEED}`);
      },
      allowedOrigins: new Set(),
    };

    it.each([
      ['a policy that cannot be read', unreadablePolicy, requestWith()],
      [
        'a request without raw headers',
        policy,
        { method: 'GET', headers: { host: '127.0.0.1:3000' } },
      ],
      ['a request that is not an object', policy, undefined],
      [
        'a request with a non-string method',
        policy,
        { method: 7, rawHeaders: ['Host', '127.0.0.1:3000'] },
      ],
    ])('rejects, and never throws anything else, on %s', (_label, usedPolicy, request) => {
      const rejection = rejectionOf(
        new LocalRequestGuard(usedPolicy, warnings().logger),
        contextFor(request),
      );
      expect(rejection.status).toBe(403);
      expect(rejection.code).toBe('HOST_NOT_ALLOWED');
      expect(`${rejection.message}${rejection.stack}`).not.toContain(SEED);
    });

    it('rejects a request that does not come over HTTP', () => {
      const rejection = rejectionOf(
        new LocalRequestGuard(policy, warnings().logger),
        contextFor(requestWith({ method: 'GET' }), 'rpc'),
      );
      expect(rejection.code).toBe('HOST_NOT_ALLOWED');
    });

    it('rejects when the execution context itself throws', () => {
      const broken = {
        getType: () => 'http',
        switchToHttp: () => {
          throw new Error(SEED);
        },
      } as unknown as ExecutionContext;
      const rejection = rejectionOf(new LocalRequestGuard(policy, warnings().logger), broken);
      expect(rejection.message).toBe('host not allowed');
    });
  });

  describe('logging', () => {
    it('warns once per rejection with the check name only', () => {
      const { events, logger } = warnings();
      const guard = new LocalRequestGuard(policy, logger);
      rejectionOf(guard, contextFor(requestWith({ host: SEED })));
      rejectionOf(guard, contextFor(requestWith({ origin: SEED })));
      expect(events).toEqual([
        [{ event: 'local_request_rejected', check: 'host' }],
        [{ event: 'local_request_rejected', check: 'origin' }],
      ]);
      expect(JSON.stringify(events)).not.toContain(SEED);
    });

    it('still rejects, with the same error, when the logger throws', () => {
      const guard = new LocalRequestGuard(policy, {
        warn: () => {
          throw new Error(SEED);
        },
      });
      const rejection = rejectionOf(guard, contextFor(requestWith({ origin: SEED })));
      expect(rejection.code).toBe('ORIGIN_NOT_ALLOWED');
      expect(rejection.message).toBe('origin not allowed');
    });
  });
});
