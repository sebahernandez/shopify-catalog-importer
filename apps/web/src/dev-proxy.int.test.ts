import { mkdtemp, rm } from 'node:fs/promises';
import {
  type IncomingHttpHeaders,
  type Server,
  createServer,
  request as httpRequest,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer as createViteServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveDevServer } from '../vite.config';

// What the API's local request guard accepts (default configuration): Host 127.0.0.1:3000,
// 127.0.0.1:5173 or localhost:5173, and for a write the Origin http://127.0.0.1:5173 or
// http://localhost:5173. A browser on the web shell sends Host 127.0.0.1:5173 and, on a write, that
// Origin. The proxy must hand both to the API exactly as they came (changeOrigin false), so the
// guard judges what the browser sent. The stub below stands in for the API; the real one is never
// started.
const BROWSER_HOST = '127.0.0.1:5173';
const BROWSER_ORIGIN = 'http://127.0.0.1:5173';

interface Seen {
  method: string | undefined;
  url: string | undefined;
  headers: IncomingHttpHeaders;
  names: string[];
}

interface Stub {
  server: Server;
  port: number;
  seen: Seen[];
}

async function startStub(): Promise<Stub> {
  const seen: Seen[] = [];
  const server = createServer((req, res) => {
    seen.push({
      method: req.method,
      url: req.url,
      headers: req.headers,
      names: req.rawHeaders.filter((_, index) => index % 2 === 0).map((name) => name.toLowerCase()),
    });
    req.resume();
    res.writeHead(200, { 'content-type': 'text/plain' }).end('stub');
  });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  return { server, port: (server.address() as AddressInfo).port, seen };
}

function send(
  port: number,
  path: string,
  headers: Record<string, string> = {},
  method = 'GET',
): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, path, method, headers, agent: false });
    req.on('response', (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode ?? 0));
    });
    req.on('error', reject);
    // Node sends no length for these methods, so a body would be a malformed request.
    req.end(['POST', 'PUT', 'PATCH'].includes(method) ? '{"a":1}' : undefined);
  });
}

function isRefused(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.on('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', (error: NodeJS.ErrnoException) => resolve(error.code === 'ECONNREFUSED'));
  });
}

function closeStub(stub: Stub): Promise<void> {
  return new Promise((resolve) => {
    if (!stub.server.listening) return resolve();
    stub.server.close(() => resolve());
    stub.server.closeAllConnections();
  });
}

let api: Stub;
let decoy: Stub;
let dev: ViteDevServer;
let devPort = 0;
let scratch = '';

beforeAll(async () => {
  api = await startStub();
  decoy = await startStub();
  scratch = await mkdtemp(join(tmpdir(), 'importer-web-proxy-'));
  dev = await createViteServer({
    configFile: false,
    root: scratch,
    cacheDir: join(scratch, '.vite'),
    logLevel: 'silent',
    appType: 'custom',
    optimizeDeps: { noDiscovery: true },
    server: {
      // The decision under test, fed with the stub as the API; only the bind is overridden so the
      // test gets an ephemeral port on the loopback address.
      ...resolveDevServer({ API_HOST: '127.0.0.1', API_PORT: String(api.port) }),
      port: 0,
      watch: null,
    },
  });
  await dev.listen();
  devPort = (dev.httpServer?.address() as AddressInfo).port;
}, 30_000);

afterAll(async () => {
  await dev.close();
  await Promise.all([closeStub(api), closeStub(decoy)]);
  await rm(scratch, { recursive: true, force: true });
});

describe('dev proxy toward the API', () => {
  it('binds the loopback address on a port of its own', () => {
    expect(dev.httpServer?.address()).toMatchObject({ address: '127.0.0.1' });
    expect(devPort).toBeGreaterThan(0);
    expect(devPort).not.toBe(api.port);
  });

  it('forwards the health route with Host, path and query untouched', async () => {
    const before = api.seen.length;
    const status = await send(devPort, '/health?probe=1&x=%20y', { host: BROWSER_HOST });
    const [seen] = api.seen.slice(before);
    expect(status).toBe(200);
    expect(api.seen).toHaveLength(before + 1);
    expect(seen?.method).toBe('GET');
    expect(seen?.url).toBe('/health?probe=1&x=%20y');
    expect(seen?.headers.host).toBe(BROWSER_HOST);
    expect(seen?.headers.origin).toBeUndefined();
  });

  it('forwards a write under the api prefix with Host and Origin as the browser sent them', async () => {
    const before = api.seen.length;
    const status = await send(
      devPort,
      '/api/imports/42?dry=1',
      { host: BROWSER_HOST, origin: BROWSER_ORIGIN, 'sec-fetch-site': 'same-origin' },
      'POST',
    );
    const [seen] = api.seen.slice(before);
    expect(status).toBe(200);
    expect(seen?.method).toBe('POST');
    expect(seen?.url).toBe('/api/imports/42?dry=1');
    expect(seen?.headers.host).toBe(BROWSER_HOST);
    expect(seen?.headers.origin).toBe(BROWSER_ORIGIN);
    expect(seen?.headers['sec-fetch-site']).toBe('same-origin');
  });

  it('passes a foreign Origin through unchanged so the guard can refuse it', async () => {
    const before = api.seen.length;
    await send(devPort, '/api/x', { host: BROWSER_HOST, origin: 'https://evil.test' }, 'DELETE');
    const [seen] = api.seen.slice(before);
    expect(seen?.method).toBe('DELETE');
    expect(seen?.headers.origin).toBe('https://evil.test');
  });

  it('neither alters nor invents Sec-Fetch-Site, Origin or forwarding headers', async () => {
    const before = api.seen.length;
    await send(devPort, '/api/a', { host: BROWSER_HOST, 'sec-fetch-site': 'cross-site' });
    await send(devPort, '/api/b', { host: BROWSER_HOST });
    const [crossSite, bare] = api.seen.slice(before);
    expect(api.seen.length - before).toBe(2);
    expect(crossSite?.headers['sec-fetch-site']).toBe('cross-site');
    expect(bare?.headers['sec-fetch-site']).toBeUndefined();
    expect(bare?.headers.origin).toBeUndefined();
    for (const seen of [crossSite, bare]) {
      expect(seen?.names.filter((name) => name === 'host')).toHaveLength(1);
      expect(seen?.names.filter((name) => /^(x-forwarded-|forwarded$|via$)/.test(name))).toEqual(
        [],
      );
    }
  });

  it('strips no prefix and forwards every state-changing method under the api prefix', async () => {
    const before = api.seen.length;
    for (const method of ['PUT', 'PATCH', 'DELETE']) {
      await send(devPort, '/api/things/7', { host: BROWSER_HOST }, method);
    }
    const urls = api.seen.slice(before).map((seen) => `${seen.method} ${seen.url}`);
    expect(urls).toEqual(['PUT /api/things/7', 'PATCH /api/things/7', 'DELETE /api/things/7']);
  });

  // Vite's default CORS handling (limited to localhost origins; this config does not enable or
  // widen it) answers a preflight itself, so the API never sees it. Same-origin requests from the
  // shell do not preflight, so nothing depends on this.
  it('answers a preflight itself and does not forward it', async () => {
    const before = api.seen.length;
    const headers = {
      host: BROWSER_HOST,
      origin: BROWSER_ORIGIN,
      'access-control-request-method': 'POST',
    };
    expect(await send(devPort, '/api/things', headers, 'OPTIONS')).toBe(204);
    expect(api.seen).toHaveLength(before);
  });

  it.each([
    '/',
    '/index.html',
    '/apix',
    '/api-docs',
    '/healthz',
    '/xapi/health',
    '/src/main.tsx',
    '/@vite/client',
    '//api/x',
  ])('forwards nothing for %s', async (path) => {
    const before = api.seen.length;
    await send(devPort, path, { host: BROWSER_HOST });
    expect(api.seen).toHaveLength(before);
  });

  it('takes the target from configuration, never from the request', async () => {
    const before = { api: api.seen.length, decoy: decoy.seen.length };
    const aimed = {
      host: BROWSER_HOST,
      'x-target': `http://127.0.0.1:${decoy.port}`,
      'x-forwarded-host': `127.0.0.1:${decoy.port}`,
      'x-proxy-target': `http://127.0.0.1:${decoy.port}`,
    };
    await send(devPort, '/api/aimed', aimed);
    await send(devPort, `http://127.0.0.1:${decoy.port}/api/absolute`, { host: BROWSER_HOST });
    expect(api.seen.slice(before.api).map((seen) => seen.url)).toEqual(['/api/aimed']);
    expect(decoy.seen).toHaveLength(before.decoy);
  });

  it('keeps the dev server host check on: a foreign Host is refused before the proxy', async () => {
    const before = api.seen.length;
    const status = await send(devPort, '/api/x', { host: 'evil.example:5173' });
    expect(status).toBe(403);
    expect(api.seen).toHaveLength(before);
  });
});

describe('cleanup', () => {
  it('closes the dev server and both stubs and frees their ports', async () => {
    const ports = [devPort, api.port, decoy.port];
    for (const port of ports) expect(await isRefused(port)).toBe(false);
    await dev.close();
    await Promise.all([closeStub(api), closeStub(decoy)]);
    for (const port of ports) expect(await isRefused(port)).toBe(true);
  });
});
