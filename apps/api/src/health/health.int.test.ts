import 'reflect-metadata';
import {
  chmodSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
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

// A key written the way the real key file is, so the application loads it instead of generating one.
function seedKey(box: Sandbox, bytes: Buffer): void {
  mkdirSync(dirname(box.keyFile), { recursive: true, mode: 0o700 });
  writeFileSync(box.keyFile, `k1:${bytes.toString('base64')}\n`, { mode: 0o600 });
  chmodSync(box.keyFile, 0o600);
}

function formsOf(bytes: Buffer): string[] {
  const b64 = bytes.toString('base64');
  const url = bytes.toString('base64url');
  const hex = bytes.toString('hex');
  return [b64, b64.replace(/=+$/, ''), url, `${url}=`, hex, hex.toUpperCase()];
}

describe('what the answer and the logs never contain', () => {
  const KEY = Buffer.from(Array.from({ length: 32 }, (_, i) => 0xa0 + i));
  const MESSAGE_MARKER = 'raw-driver-message-marker';

  // Every recognisable value the process holds: the key in each textual form, the key file line,
  // every path the sandbox gave the application, and the versions of the runtime.
  function markers(): string[] {
    return [
      ...formsOf(KEY),
      `k1:${KEY.toString('base64')}`,
      sb.root,
      basename(sb.root),
      sb.dataDir,
      databaseFilePath(sb.dataDir),
      sb.keyFile,
      sb.home,
      tmpdir(),
      process.version,
      process.versions.node,
      process.versions.v8,
      MESSAGE_MARKER,
    ];
  }

  const wholeReply = (reply: Reply): string =>
    JSON.stringify({ status: reply.status, headers: reply.headers, body: reply.body });

  function expectNoMarker(text: string): void {
    expect(text.length).toBeGreaterThan(0);
    for (const marker of markers()) expect(text).not.toContain(marker);
  }

  async function bootWithKey(): Promise<BootHandle> {
    seedKey(sb, KEY);
    // Configuration values are seeded with the markers too: they are set, so they could leak.
    return boot({ DATA_DIR: sb.dataDir, SECRET_KEY_FILE: sb.keyFile });
  }

  it('markers are real: each one is present in the sandbox the application runs in', () => {
    seedKey(sb, KEY);
    expect(readFileSync(sb.keyFile, 'utf8')).toContain(KEY.toString('base64'));
    expect(databaseFilePath(sb.dataDir).startsWith(sb.dataDir)).toBe(true);
    expect(sb.dataDir.startsWith(sb.root)).toBe(true);
    expect(markers().length).toBeGreaterThan(12);
  });

  it('holds for the healthy answer: response, headers and every log line', async () => {
    const handle = await bootWithKey();
    const replies = await Promise.all([
      send(handle.address.port, 'GET', '/health'),
      send(handle.address.port, 'GET', '/health', { origin: 'https://evil.example' }),
      send(handle.address.port, 'HEAD', '/health'),
    ]);
    for (const reply of replies) {
      expect(reply.status).toBe(200);
      expectNoMarker(wholeReply(reply));
    }
    expect(Object.keys(JSON.parse(replies[0]?.body ?? '{}') as object).sort()).toEqual([
      'database',
      'shopifyApiVersion',
      'status',
    ]);
    expect(lines.length).toBeGreaterThan(3);
    expectNoMarker(lines.join('\n'));
  });

  it('holds for the degraded answer, whichever way the database is down', async () => {
    const handle = await bootWithKey();
    const port = handle.address.port;
    const answers: Reply[] = [];

    const check = vi.spyOn(PrismaService.prototype, 'isReachable');
    check.mockRejectedValueOnce(
      new Error(`${MESSAGE_MARKER} ${markers().join(' ')} at ${sb.dataDir}`),
    );
    answers.push(await send(port, 'GET', '/health'));

    await theService().disconnect();
    answers.push(await send(port, 'GET', '/health'));

    for (const reply of answers) {
      expect(reply.status).toBe(503);
      expectNoMarker(wholeReply(reply));
      expect(Object.keys(JSON.parse(reply.body) as object).sort()).toEqual([
        'database',
        'shopifyApiVersion',
        'status',
      ]);
    }
    expectNoMarker(lines.join('\n'));
  });

  it('holds when the database file is gone, and the log carries no health error at all', async () => {
    const handle = await bootWithKey();
    const before = lines.length;
    rmSync(databaseFilePath(sb.dataDir));
    const reply = await send(handle.address.port, 'GET', '/health');
    expect(reply.status).toBe(503);
    expectNoMarker(wholeReply(reply));
    expectNoMarker(lines.join('\n'));
    expect(lines.slice(before).join('\n')).not.toMatch(/ENOENT|SQLITE|unable to open/i);
  });
});

describe('GET /health is read-only', () => {
  const CALLS = 25;

  function dataFiles(): string[] {
    return readdirSync(sb.dataDir).sort();
  }

  function databaseState(): { rows: unknown[]; size: number; mtimeMs: number } {
    const file = databaseFilePath(sb.dataDir);
    const { size, mtimeMs } = statSync(file);
    const db = new Database(file, { readonly: true });
    try {
      const rows = db.prepare('SELECT key, value, updated_at FROM app_setting ORDER BY key').all();
      return { rows, size, mtimeMs };
    } finally {
      db.close();
    }
  }

  const callMany = (port: number, headers: Record<string, string> = {}): Promise<Reply[]> =>
    Promise.all(
      Array.from({ length: CALLS }, (_, i) =>
        send(port, i % 2 === 0 ? 'GET' : 'HEAD', '/health', headers),
      ),
    );

  it('leaves the key-check row, the database file and the data directory as they were', async () => {
    const handle = await boot();
    const files = dataFiles();
    const before = databaseState();
    expect(before.rows).toHaveLength(1);
    const keyBefore = readFileSync(sb.keyFile);

    const replies = [
      ...(await callMany(handle.address.port)),
      ...(await callMany(handle.address.port, { origin: 'https://evil.example' })),
    ];

    expect(replies).toHaveLength(CALLS * 2);
    expect(replies.every((reply) => reply.status === 200)).toBe(true);
    expect(dataFiles()).toEqual(files);
    expect(databaseState()).toEqual(before);
    expect(readFileSync(sb.keyFile).equals(keyBefore)).toBe(true);
  });

  it('creates nothing when the database is down: the removed file stays removed', async () => {
    const handle = await boot();
    rmSync(databaseFilePath(sb.dataDir));
    const files = dataFiles();
    expect(files).not.toContain('importer.db');

    const replies = await callMany(handle.address.port);

    expect(replies.every((reply) => reply.status === 503)).toBe(true);
    expect(dataFiles()).toEqual(files);
    expect(() => statSync(databaseFilePath(sb.dataDir))).toThrow(/ENOENT/);
  });

  it('writes nothing when the service is disconnected', async () => {
    const handle = await boot();
    // Closing the connection checkpoints the log into the file, so the state is read afterwards.
    await theService().disconnect();
    const before = databaseState();
    const replies = await callMany(handle.address.port);
    expect(replies.every((reply) => reply.status === 503)).toBe(true);
    expect(databaseState()).toEqual(before);
  });
});
