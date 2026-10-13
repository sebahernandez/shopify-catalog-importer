import { createServer, request, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createCorsMiddleware } from './cors-middleware.js';

const ALLOWED = ['http://127.0.0.1:5173', 'http://localhost:5173'];

interface Reply {
  status: number;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}

let server: Server | undefined;

// A real server on an ephemeral loopback port: the middleware under test, then a stand-in for
// the router that answers 200 "next". Reaching it means the middleware let the request through.
async function serve(allowed: readonly string[] = ALLOWED): Promise<number> {
  const middleware = createCorsMiddleware(allowed);
  server = createServer((req, res) => {
    middleware(req, res, () => {
      res.statusCode = 200;
      res.end('next');
    });
  });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
  return (server.address() as AddressInfo).port;
}

function send(port: number, method: string, headers: Record<string, string>): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method, path: '/x', headers, agent: false });
    req.on('response', (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          body: Buffer.concat(chunks).toString('utf8'),
          headers: res.headers,
        }),
      );
    });
    req.on('error', reject);
    req.end();
  });
}

const preflight = (origin: string): Record<string, string> => ({
  origin,
  'access-control-request-method': 'POST',
  'access-control-request-headers': 'content-type',
});

/** Every response header that belongs to the CORS protocol. */
function corsHeaders(reply: Reply): string[] {
  return Object.keys(reply.headers).filter((name) => name.startsWith('access-control-'));
}

afterEach(async () => {
  await new Promise<void>((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
    server.closeAllConnections();
  });
  server = undefined;
});

describe('preflight from an allow-listed origin', () => {
  it.each(ALLOWED)('answers %s itself and allows exactly that origin', async (origin) => {
    const port = await serve();
    const reply = await send(port, 'OPTIONS', preflight(origin));
    expect(reply.status).toBe(204);
    expect(reply.body).toBe('');
    expect(reply.headers['access-control-allow-origin']).toBe(origin);
    expect(reply.headers['access-control-allow-methods']).toBe('GET,POST,PUT,PATCH,DELETE');
    expect(reply.headers['access-control-allow-headers']).toBe('Content-Type');
    expect(reply.headers['vary']).toBe('Origin');
    expect(reply.headers['content-length']).toBe('0');
    expect(corsHeaders(reply).sort()).toEqual([
      'access-control-allow-headers',
      'access-control-allow-methods',
      'access-control-allow-origin',
    ]);
  });
});

describe('preflight from any other origin', () => {
  it.each([
    'https://evil.example',
    'null',
    'http://127.0.0.1:5174',
    'http://127.0.0.1',
    'https://localhost:5173',
    'http://LOCALHOST:5173',
    'http://localhost:5173/',
    'http://localhost:5173, http://127.0.0.1:5173',
    '*',
    '',
  ])('is answered with no CORS header at all for %j', async (origin) => {
    const port = await serve();
    const reply = await send(port, 'OPTIONS', preflight(origin));
    expect(reply.status).toBe(204);
    expect(reply.body).toBe('');
    expect(corsHeaders(reply)).toEqual([]);
    expect(reply.headers['vary']).toBe('Origin');
  });
});

describe('OPTIONS that is not a preflight', () => {
  it('without Origin is left to the router and carries no CORS header', async () => {
    const port = await serve();
    const reply = await send(port, 'OPTIONS', { 'access-control-request-method': 'POST' });
    expect(reply.body).toBe('next');
    expect(corsHeaders(reply)).toEqual([]);
    expect(reply.headers['vary']).toBe('Origin');
  });

  it('without Access-Control-Request-Method is left to the router', async () => {
    const port = await serve();
    const allowed = await send(port, 'OPTIONS', { origin: ALLOWED[1] ?? '' });
    expect(allowed.body).toBe('next');
    expect(allowed.headers['access-control-allow-origin']).toBe(ALLOWED[1]);
    expect(allowed.headers['access-control-allow-methods']).toBeUndefined();
    const foreign = await send(port, 'OPTIONS', { origin: 'https://evil.example' });
    expect(foreign.body).toBe('next');
    expect(corsHeaders(foreign)).toEqual([]);
  });
});

describe('actual requests', () => {
  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])(
    'passes an allowed-origin %s through and names the origin',
    async (method) => {
      const port = await serve();
      const reply = await send(port, method, { origin: ALLOWED[0] ?? '' });
      expect(reply.body).toBe('next');
      expect(reply.headers['access-control-allow-origin']).toBe(ALLOWED[0]);
      expect(reply.headers['vary']).toBe('Origin');
      expect(corsHeaders(reply)).toEqual(['access-control-allow-origin']);
    },
  );

  it.each(['GET', 'POST', 'DELETE'])(
    'passes a foreign-origin %s through with no allow header, so the page cannot read it',
    async (method) => {
      const port = await serve();
      const reply = await send(port, method, { origin: 'https://evil.example' });
      expect(reply.body).toBe('next');
      expect(corsHeaders(reply)).toEqual([]);
      expect(reply.headers['vary']).toBe('Origin');
    },
  );

  it('passes a request with no Origin through, still varying on Origin', async () => {
    const port = await serve();
    const reply = await send(port, 'GET', {});
    expect(reply.body).toBe('next');
    expect(corsHeaders(reply)).toEqual([]);
    expect(reply.headers['vary']).toBe('Origin');
  });

  it('never allows credentials, whatever the origin and method', async () => {
    const port = await serve();
    const replies = [
      await send(port, 'OPTIONS', preflight(ALLOWED[0] ?? '')),
      await send(port, 'GET', { origin: ALLOWED[1] ?? '' }),
      await send(port, 'OPTIONS', preflight('https://evil.example')),
    ];
    expect(replies).toHaveLength(3);
    for (const reply of replies) {
      expect(reply.headers['access-control-allow-credentials']).toBeUndefined();
      expect(reply.headers['access-control-allow-origin']).not.toBe('*');
    }
  });

  it('reflects only the configured origins: a custom list replaces the defaults', async () => {
    const port = await serve(['https://panel.example:8443']);
    const own = await send(port, 'GET', { origin: 'https://panel.example:8443' });
    expect(own.headers['access-control-allow-origin']).toBe('https://panel.example:8443');
    const dropped = await send(port, 'GET', { origin: ALLOWED[0] ?? '' });
    expect(corsHeaders(dropped)).toEqual([]);
  });

  it('allows nobody when the list is empty', async () => {
    const port = await serve([]);
    const reply = await send(port, 'OPTIONS', preflight(ALLOWED[0] ?? ''));
    expect(reply.status).toBe(204);
    expect(corsHeaders(reply)).toEqual([]);
  });
});

describe('construction', () => {
  it.each([
    '*',
    'http://localhost:5173/',
    'localhost:5173',
    'http://a.example/path',
    'ftp://a.b',
    '',
  ])('refuses %j: only canonical http(s) origins are accepted, never a wildcard', (origin) => {
    expect(() => createCorsMiddleware([origin])).toThrow(/not a canonical origin/);
  });

  it('does not echo the offending value in the error', () => {
    expect(() => createCorsMiddleware(['http://seed-9f3a.example/p'])).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('seed-9f3a') as unknown }),
    );
  });
});
