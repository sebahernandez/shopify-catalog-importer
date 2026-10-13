import 'reflect-metadata';
import { request, type Server } from 'node:http';
import { connect, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  Controller,
  Delete,
  Get,
  Module,
  Patch,
  Post,
  Put,
  type INestApplication,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiError } from '@importer/contracts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_CONFIG, ConfigModule } from '../config/config.module.js';
import { LocalSecurityModule } from './local-security.module.js';

// The test-only write route of design D7. S0 has no state-changing endpoint, so this controller
// is declared here, registered only in a module this file assembles, and never reaches AppModule
// or dist (see no-test-route-ships.test.ts). It records every handler that runs.
const ran: string[] = [];
const SEED = 'odd-seed-77be.example';

@Controller('guarded-test')
class TestController {
  @Get('read') read(): { ok: true } {
    ran.push('GET');
    return { ok: true };
  }
  @Post('write') post(): { ok: true } {
    ran.push('POST');
    return { ok: true };
  }
  @Put('write') put(): { ok: true } {
    ran.push('PUT');
    return { ok: true };
  }
  @Patch('write') patch(): { ok: true } {
    ran.push('PATCH');
    return { ok: true };
  }
  @Delete('write') remove(): { ok: true } {
    ran.push('DELETE');
    return { ok: true };
  }
  @Get('boom') boom(): never {
    ran.push('BOOM');
    throw new Error(`internal detail ${SEED}`);
  }
}

interface Reply {
  status: number;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}

let app: INestApplication | undefined;
let port = 0;
let warnings: unknown[][] = [];

// Only synthetic input: an explicit environment, and file locations that are never created.
function configFor(env: Record<string, string>) {
  return ConfigModule.forRoot({
    env,
    envFile: join(tmpdir(), 'importer-guard-test-absent.env'),
    home: join(tmpdir(), 'importer-guard-test-home'),
  });
}

async function boot(env: Record<string, string> = {}): Promise<void> {
  @Module({
    imports: [
      LocalSecurityModule.forRoot(configFor(env), {
        logger: { warn: (...args: unknown[]) => void warnings.push(args) },
      }),
    ],
    controllers: [TestController],
  })
  class TestAppModule {}

  app = await NestFactory.create(TestAppModule, { logger: false, abortOnError: false });
  await app.listen(0, '127.0.0.1');
  const address = (app.getHttpServer() as Server).address() as AddressInfo;
  expect(address.address).toBe('127.0.0.1');
  port = address.port;
}

// The Host header is set by hand: the configured API port is not the ephemeral one.
function send(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  host = '127.0.0.1:3000',
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request(
      { host: '127.0.0.1', port, method, path, headers: { host, ...headers }, agent: false },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString('utf8'),
            headers: res.headers,
          }),
        );
      },
    );
    req.on('error', reject);
    req.end();
  });
}

function sendRaw(lines: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host: '127.0.0.1', port });
    let received = '';
    socket.setEncoding('utf8');
    socket.on('connect', () => socket.write(`${lines.join('\r\n')}\r\nConnection: close\r\n\r\n`));
    socket.on('data', (chunk: string) => (received += chunk));
    socket.on('end', () => resolve(received));
    socket.on('error', reject);
  });
}

const errorBody = (reply: Reply): ApiError => ApiError.parse(JSON.parse(reply.body));

beforeEach(() => {
  ran.length = 0;
  warnings = [];
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('the local request guard over HTTP', () => {
  it('rejects a foreign-origin write with 403 and never runs the handler', async () => {
    await boot();
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const reply = await send(method, '/guarded-test/write', { origin: 'https://evil.example' });
      expect(reply.status).toBe(403);
      expect(errorBody(reply)).toEqual({
        error: { code: 'ORIGIN_NOT_ALLOWED', message: 'origin not allowed' },
      });
      expect(String(reply.headers['content-type'])).toContain('application/json');
    }
    expect(ran).toEqual([]);
  });

  it('runs the handler for an allowed origin, and for a request with no Origin', async () => {
    await boot();
    expect(
      (await send('POST', '/guarded-test/write', { origin: 'http://localhost:5173' })).status,
    ).toBe(201);
    expect((await send('POST', '/guarded-test/write')).status).toBe(201);
    expect(ran).toEqual(['POST', 'POST']);
  });

  it.each([
    ['same-origin', 201],
    ['none', 201],
    ['same-site', 403],
    ['cross-site', 403],
    ['banana', 403],
  ])('with no Origin and Sec-Fetch-Site %s answers %i', async (value, status) => {
    await boot();
    const reply = await send('POST', '/guarded-test/write', { 'sec-fetch-site': value });
    expect(reply.status).toBe(status);
    expect(ran).toHaveLength(status === 201 ? 1 : 0);
  });

  it('rejects the null origin, and a forged Sec-Fetch-Site does not rescue a foreign origin', async () => {
    await boot();
    expect((await send('POST', '/guarded-test/write', { origin: 'null' })).status).toBe(403);
    const forged = await send('POST', '/guarded-test/write', {
      origin: 'https://evil.example',
      'sec-fetch-site': 'same-origin',
    });
    expect(forged.status).toBe(403);
    expect(ran).toEqual([]);
  });

  it('never blocks a safe method on its Origin or Sec-Fetch-Site', async () => {
    await boot();
    const hostile = { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site' };
    expect((await send('GET', '/guarded-test/read', hostile)).status).toBe(200);
    expect((await send('HEAD', '/guarded-test/read', hostile)).status).toBe(200);
    expect(ran).toEqual(['GET', 'GET']);
  });

  it('applies the Host rule to every method, and checks it before the Origin', async () => {
    await boot();
    for (const [method, path] of [
      ['GET', '/guarded-test/read'],
      ['POST', '/guarded-test/write'],
    ] as const) {
      const reply = await send(method, path, { origin: 'http://localhost:5173' }, 'evil.test');
      expect(reply.status).toBe(403);
      expect(errorBody(reply)).toEqual({
        error: { code: 'HOST_NOT_ALLOWED', message: 'host not allowed' },
      });
    }
    // Both the Host and the Origin are wrong: the Host is reported.
    const both = await send('POST', '/guarded-test/write', { origin: SEED }, SEED);
    expect(errorBody(both).error.code).toBe('HOST_NOT_ALLOWED');
    expect(ran).toEqual([]);
  });

  it('accepts the Host the configuration names and refuses the port the server really uses', async () => {
    await boot();
    expect((await send('GET', '/guarded-test/read')).status).toBe(200);
    const byRealPort = await send('GET', '/guarded-test/read', {}, `127.0.0.1:${port}`);
    expect(byRealPort.status).toBe(403);
    expect(ran).toEqual(['GET']);
  });

  it('follows the configuration: another API port and another allowed origin', async () => {
    await boot({ API_PORT: '4000', ALLOWED_ORIGINS: 'https://app.example' });
    expect((await send('GET', '/guarded-test/read', {}, '127.0.0.1:4000')).status).toBe(200);
    expect((await send('GET', '/guarded-test/read', {}, '127.0.0.1:3000')).status).toBe(403);
    const write = (origin: string) =>
      send('POST', '/guarded-test/write', { origin }, '127.0.0.1:4000');
    expect((await write('https://app.example')).status).toBe(201);
    expect((await write('http://localhost:5173')).status).toBe(403);
  });

  it('echoes no request value back, whichever header was wrong', async () => {
    await boot();
    const replies = [
      await send('GET', '/guarded-test/read', {}, SEED),
      await send('POST', '/guarded-test/write', { origin: SEED }),
      await send('POST', '/guarded-test/write', { 'sec-fetch-site': SEED }),
    ];
    for (const reply of replies) {
      expect(reply.status).toBe(403);
      expect(JSON.stringify(reply)).not.toContain(SEED);
    }
  });

  it('rejects a repeated Origin even when every copy is allowed', async () => {
    await boot();
    const text = await sendRaw([
      'POST /guarded-test/write HTTP/1.1',
      'Host: 127.0.0.1:3000',
      'Origin: http://localhost:5173',
      'Origin: http://localhost:5173',
    ]);
    expect(text.split('\r\n')[0]).toBe('HTTP/1.1 403 Forbidden');
    expect(ran).toEqual([]);
  });

  it('rejects a repeated Host with the guard, not only with the parser', async () => {
    await boot();
    const text = await sendRaw([
      'GET /guarded-test/read HTTP/1.1',
      'Host: 127.0.0.1:3000',
      'Host: 127.0.0.1:3000',
    ]);
    // Node hands a repeated Host to the application (it keeps only the first in `headers`).
    expect(text.split('\r\n')[0]).toBe('HTTP/1.1 403 Forbidden');
    expect(text).toContain('HOST_NOT_ALLOWED');
    expect(ran).toEqual([]);
  });

  it('does not run a handler for a request with no Host: the parser refuses it', async () => {
    await boot();
    const text = await sendRaw(['GET /guarded-test/read HTTP/1.1']);
    expect(text.split('\r\n')[0]).toBe('HTTP/1.1 400 Bad Request');
    expect(ran).toEqual([]);
  });

  it('logs one warn event per rejection with the check name, and nothing for an allowed request', async () => {
    await boot();
    await send('GET', '/guarded-test/read');
    expect(warnings).toEqual([]);
    await send('POST', '/guarded-test/write', { origin: SEED });
    await send('GET', '/guarded-test/read', {}, SEED);
    expect(warnings).toEqual([
      [{ event: 'local_request_rejected', check: 'origin' }],
      [{ event: 'local_request_rejected', check: 'host' }],
    ]);
  });

  it('leaves an unexpected handler error to the framework, which does not leak it', async () => {
    await boot();
    const reply = await send('GET', '/guarded-test/boom');
    expect(reply.status).toBe(500);
    expect(reply.body).not.toContain(SEED);
    expect(reply.body).not.toContain('internal detail');
    expect(reply.body).not.toContain('at ');
    expect(ran).toEqual(['BOOM']);
  });
});

describe('the module fails closed', () => {
  it('refuses to build when the configuration gives it an address it cannot trust', async () => {
    @Module({
      providers: [
        {
          provide: APP_CONFIG,
          useValue: { apiHost: `${SEED} x`, apiPort: 3000, allowedOrigins: [] },
        },
      ],
      exports: [APP_CONFIG],
    })
    class UnusableConfig {}

    @Module({ imports: [LocalSecurityModule.forRoot({ module: UnusableConfig })] })
    class BrokenAppModule {}

    const failure: unknown = await NestFactory.create(BrokenAppModule, {
      logger: false,
      abortOnError: false,
    }).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe(
      'Local request guard: the API host or port is not usable.',
    );
    expect((failure as Error).message).not.toContain(SEED);
  });
});

describe('OPTIONS and preflight', () => {
  it.each([
    ['a preflight with Access-Control-Request-Method', { 'access-control-request-method': 'POST' }],
    ['a plain OPTIONS', {}],
  ])('%s from a foreign origin never runs a write handler', async (_label, extra) => {
    await boot();
    const reply = await send('OPTIONS', '/guarded-test/write', {
      origin: 'https://evil.example',
      ...extra,
    });
    expect(ran).toEqual([]);
    expect(reply.headers['access-control-allow-origin']).toBeUndefined();
    // Nest registers no OPTIONS handler: without the CORS middleware (U13) the router answers 404,
    // so an OPTIONS request that the guard lets through still reaches nothing.
    expect(reply.status).toBe(404);
  });
});
