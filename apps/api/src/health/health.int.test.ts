import 'reflect-metadata';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiError, HealthResponse } from '@importer/contracts';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { bootstrap, type BootHandle } from '../main.js';
import { databaseFilePath, prepareDatabaseFile } from '../persistence/database-location.js';
import { PrismaService } from '../persistence/prisma.service.js';
import { clearRegisteredSecretsForTests } from '../shared-kernel/logging/redact.js';

// Task 14.1: the health route over real HTTP. Each test boots the real application (AppModule, no
// extra module) on a loopback ephemeral port, inside a fresh temporary folder that holds the data
// directory, the key file, the home directory and the workspace root.

interface Sandbox {
  root: string;
  dataDir: string;
  keyFile: string;
  home: string;
}

interface Reply {
  status: number;
  body: string;
  headers: Record<string, string | string[] | undefined>;
}

const PINNED_VERSION = '2031-07';
const SQL = new URL(
  '../../prisma/migrations/20261013180211_baseline/migration.sql',
  import.meta.url,
);

async function makeSandbox(): Promise<Sandbox> {
  const root = await mkdtemp(join(tmpdir(), 'importer-health-'));
  const box = {
    root,
    dataDir: join(root, 'data'),
    keyFile: join(root, 'keys', 'secret.key'),
    home: join(root, 'home'),
  };
  mkdirSync(box.home);
  prepareDatabaseFile(box.dataDir);
  const db = new Database(databaseFilePath(box.dataDir));
  try {
    db.exec(readFileSync(SQL, 'utf8'));
  } finally {
    db.close();
  }
  return box;
}

let sb: Sandbox;
let lines: string[];
let handles: BootHandle[];
let connectSpy: MockInstance<PrismaService['connect']>;

async function boot(env: Record<string, string> = {}): Promise<BootHandle> {
  const handle = await bootstrap({
    env: {
      DATA_DIR: sb.dataDir,
      SECRET_KEY_FILE: sb.keyFile,
      SHOPIFY_API_VERSION: PINNED_VERSION,
      ...env,
    },
    workspaceRoot: sb.root,
    home: sb.home,
    sink: (line) => lines.push(line),
    port: 0,
  });
  handles.push(handle);
  return handle;
}

function send(
  port: number,
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

const theService = (): PrismaService => connectSpy.mock.contexts[0] as PrismaService;

const parse = (reply: Reply): HealthResponse =>
  HealthResponse.strict().parse(JSON.parse(reply.body));

const HEALTHY = { status: 'ok', database: 'up', shopifyApiVersion: PINNED_VERSION };
const DEGRADED = { status: 'degraded', database: 'down', shopifyApiVersion: PINNED_VERSION };

beforeEach(async () => {
  clearRegisteredSecretsForTests();
  lines = [];
  handles = [];
  sb = await makeSandbox();
  // The boot reports failures by throwing; a test must never end the worker.
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit must not be called by bootstrap()');
  });
  // Calls through; its recorded `this` is how a test reaches the one service the application made.
  connectSpy = vi.spyOn(PrismaService.prototype, 'connect');
});

afterEach(async () => {
  for (const handle of handles) await handle.close();
  vi.restoreAllMocks();
  await rm(sb.root, { recursive: true, force: true });
});

describe('GET /health with a reachable database', () => {
  it('answers 200 with the shared body, reading the pinned version from configuration', async () => {
    const handle = await boot();
    const reply = await send(handle.address.port, 'GET', '/health');
    expect(reply.status).toBe(200);
    expect(reply.headers['content-type']).toMatch(/^application\/json/);
    expect(parse(reply)).toEqual(HEALTHY);
  });

  it('reports a different pinned version when the configuration says so', async () => {
    const handle = await boot({ SHOPIFY_API_VERSION: '2044-01' });
    const reply = await send(handle.address.port, 'GET', '/health');
    expect(reply.status).toBe(200);
    expect(parse(reply)).toEqual({ ...HEALTHY, shopifyApiVersion: '2044-01' });
  });

  it('lives at the root: the same path under the api prefix is not a route', async () => {
    const handle = await boot();
    const prefixed = await send(handle.address.port, 'GET', '/api/health');
    expect(prefixed.status).toBe(404);
    expect(prefixed.body).not.toContain('"database"');
  });

  it('answers a HEAD request like a GET without a body', async () => {
    const handle = await boot();
    const reply = await send(handle.address.port, 'HEAD', '/health');
    expect(reply.status).toBe(200);
    expect(reply.body).toBe('');
  });
});

describe('GET /health when the database is not reachable', () => {
  const expectDegraded = (reply: Reply): void => {
    expect(reply.status).toBe(503);
    expect(reply.headers['content-type']).toMatch(/^application\/json/);
    expect(parse(reply)).toEqual(DEGRADED);
  };

  it('answers 503 with the degraded body after the service is disconnected', async () => {
    const handle = await boot();
    expect((await send(handle.address.port, 'GET', '/health')).status).toBe(200);
    await theService().disconnect();
    expectDegraded(await send(handle.address.port, 'GET', '/health'));
  });

  it('answers 503 once the database file has been removed, and does not recreate it', async () => {
    const handle = await boot();
    expect((await send(handle.address.port, 'GET', '/health')).status).toBe(200);
    rmSync(databaseFilePath(sb.dataDir));
    expectDegraded(await send(handle.address.port, 'GET', '/health'));
    expectDegraded(await send(handle.address.port, 'GET', '/health'));
    expect(() => readFileSync(databaseFilePath(sb.dataDir))).toThrow(/ENOENT/);
  });

  it('answers 503 once the database file has been replaced by another file', async () => {
    const handle = await boot();
    expect((await send(handle.address.port, 'GET', '/health')).status).toBe(200);
    const stranger = join(sb.dataDir, 'stranger.db');
    writeFileSync(stranger, 'not the database that was opened');
    renameSync(stranger, databaseFilePath(sb.dataDir));
    expectDegraded(await send(handle.address.port, 'GET', '/health'));
  });

  it('answers 503, never 500, when the check itself throws, and names no error', async () => {
    const handle = await boot();
    vi.spyOn(PrismaService.prototype, 'isReachable').mockRejectedValue(
      new Error('driver failure at the-error-marker'),
    );
    const reply = await send(handle.address.port, 'GET', '/health');
    expectDegraded(reply);
    expect(reply.body).not.toContain('the-error-marker');
    expect(lines.join('\n')).not.toContain('the-error-marker');
  });

  it('answers 503 when the check throws before it returns a promise', async () => {
    const handle = await boot();
    vi.spyOn(PrismaService.prototype, 'isReachable').mockImplementation(() => {
      throw new Error('sync failure');
    });
    expectDegraded(await send(handle.address.port, 'GET', '/health'));
  });

  it('recovers as soon as the check passes again, since nothing is cached', async () => {
    const handle = await boot();
    const check = vi.spyOn(PrismaService.prototype, 'isReachable');
    check.mockResolvedValueOnce(false);
    expectDegraded(await send(handle.address.port, 'GET', '/health'));
    const again = await send(handle.address.port, 'GET', '/health');
    expect(again.status).toBe(200);
    expect(parse(again)).toEqual(HEALTHY);
  });
});

describe('the local request guard around GET /health', () => {
  const FOREIGN = 'https://evil.example';

  it('runs the handler for a foreign Origin and gives the page no allow header to read it with', async () => {
    const handle = await boot();
    const check = vi.spyOn(PrismaService.prototype, 'isReachable');
    const reply = await send(handle.address.port, 'GET', '/health', { origin: FOREIGN });
    expect(reply.status).toBe(200);
    expect(parse(reply)).toEqual(HEALTHY);
    expect(check).toHaveBeenCalledTimes(1);
    expect(reply.headers['access-control-allow-origin']).toBeUndefined();
    expect(reply.headers['vary']).toBe('Origin');
  });

  it('answers a foreign-origin read of the degraded body the same way, also without the header', async () => {
    const handle = await boot();
    vi.spyOn(PrismaService.prototype, 'isReachable').mockResolvedValue(false);
    const reply = await send(handle.address.port, 'GET', '/health', { origin: FOREIGN });
    expect(reply.status).toBe(503);
    expect(parse(reply)).toEqual(DEGRADED);
    expect(reply.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('names an allow-listed origin in the answer, as for every route', async () => {
    const handle = await boot();
    const reply = await send(handle.address.port, 'GET', '/health', {
      origin: 'http://localhost:5173',
    });
    expect(reply.status).toBe(200);
    expect(reply.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('rejects a Host that is not allowed with the ApiError body, and never runs the check', async () => {
    const handle = await boot();
    const check = vi.spyOn(PrismaService.prototype, 'isReachable');
    const reply = await send(handle.address.port, 'GET', '/health', {}, 'attacker.example:3000');
    expect(reply.status).toBe(403);
    expect(ApiError.parse(JSON.parse(reply.body)).error.code).toBe('HOST_NOT_ALLOWED');
    expect(check).not.toHaveBeenCalled();
  });
});

describe('methods other than GET', () => {
  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'does not route %s /health to the handler: the router answers 404',
    async (method) => {
      const handle = await boot();
      const check = vi.spyOn(PrismaService.prototype, 'isReachable');
      const reply = await send(handle.address.port, method, '/health');
      expect(reply.status).toBe(404);
      expect(reply.body).not.toContain('"database"');
      expect(check).not.toHaveBeenCalled();
    },
  );

  it('does not run the handler for a foreign-origin POST either', async () => {
    const handle = await boot();
    const check = vi.spyOn(PrismaService.prototype, 'isReachable');
    const reply = await send(handle.address.port, 'POST', '/health', {
      origin: 'https://evil.example',
    });
    expect(reply.status).toBeGreaterThanOrEqual(400);
    expect(reply.body).not.toContain('"database"');
    expect(reply.headers['access-control-allow-origin']).toBeUndefined();
    expect(check).not.toHaveBeenCalled();
  });
});

describe('concurrent requests', () => {
  it('answers every one of twenty simultaneous calls correctly', async () => {
    const handle = await boot();
    const replies = await Promise.all(
      Array.from({ length: 20 }, () => send(handle.address.port, 'GET', '/health')),
    );
    expect(replies).toHaveLength(20);
    for (const reply of replies) {
      expect(reply.status).toBe(200);
      expect(parse(reply)).toEqual(HEALTHY);
    }
  });

  it('answers every one of twenty simultaneous calls correctly while the database is down', async () => {
    const handle = await boot();
    await theService().disconnect();
    const replies = await Promise.all(
      Array.from({ length: 20 }, () => send(handle.address.port, 'GET', '/health')),
    );
    expect(replies).toHaveLength(20);
    for (const reply of replies) {
      expect(reply.status).toBe(503);
      expect(parse(reply)).toEqual(DEGRADED);
    }
  });

  it('boots one service and spies on one connect call, so the helper is not vacuous', async () => {
    await boot();
    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(theService()).toBeInstanceOf(PrismaService);
  });
});
