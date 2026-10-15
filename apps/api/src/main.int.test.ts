import 'reflect-metadata';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { request, type Server } from 'node:http';
import { connect, createServer, type AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { ApiError } from '@importer/contracts';
import { Controller, Get, Logger, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import Database from 'better-sqlite3';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { ConfigError } from './config/env.schema.js';
import { EnvFileError } from './config/load-config.js';
import { AppModule } from './app.module.js';
import { bootstrap, type BootHandle, type BootstrapOptions, type ListenFunction } from './main.js';
import { databaseFilePath } from './persistence/database-location.js';
import { PersistenceError } from './persistence/persistence-error.js';
import { applyMigrations } from './persistence/test-support/apply-migrations.js';
import { BootError } from './shared-kernel/boot-error.js';
import { clearRegisteredSecretsForTests } from './shared-kernel/logging/redact.js';
import { DeferredSecretBox } from './shared-kernel/secret-box/deferred-secret-box.js';
import { AesGcmSecretBox } from './shared-kernel/secret-box/infrastructure/aes-gcm-secret-box.js';

// The test-only write route of design D7 (task 13.2). S0 has no state-changing endpoint, so these
// controllers are declared here, registered only in the module this file builds and hands to
// bootstrap(), and never reach AppModule or dist (see no-test-route-ships.test.ts).
const ran: string[] = [];
let probeForms: string[] = [];

@Controller('guarded-test')
class TestController {
  @Get('read') read(): { ok: true } {
    ran.push('GET');
    return { ok: true };
  }
  @Post('write') write(): { ok: true } {
    ran.push('POST');
    return { ok: true };
  }
}

@Controller('things')
class ThingsController {
  @Get() list(): { things: [] } {
    return { things: [] };
  }
}

// Stands in for the health route (U14), which keeps its root location: it must not get the prefix.
@Controller('health')
class HealthProbeController {
  @Get() probe(): { probe: true } {
    return { probe: true };
  }
}

// Logs the key in every form through the application logger, the way careless code could.
@Controller('probe')
class ProbeController {
  @Get('log') log(): { ok: true } {
    const logger = new Logger('Probe');
    logger.warn(`probe-marker ${probeForms.join(' ')}`);
    logger.error(new Error(`probe-failure ${probeForms[0] ?? ''}`));
    logger.log({ detail: probeForms[1] });
    return { ok: true };
  }
}

@Module({ controllers: [TestController, ThingsController, HealthProbeController, ProbeController] })
class TestRoutesModule {}

// A provider that throws while the application is being created. Nest's default answer to that
// is process.abort(); bootstrap() must turn it into an ordinary rejected promise.
@Module({
  providers: [
    {
      provide: 'EXPLODES',
      useFactory: (): never => {
        throw new Error('provider exploded');
      },
    },
  ],
})
class BrokenModule {}

// Logs the key while the application is still being created, which is before the database is
// connected and before the key check has run: only an already existing key can be hidden by then.
@Module({
  providers: [
    {
      provide: 'LOGS_EARLY',
      useFactory: (): true => {
        new Logger('Early').warn(`early-marker ${probeForms.join(' ')}`);
        return true;
      },
    },
  ],
})
class EarlyLogModule {}

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

const ALLOWED = 'http://localhost:5173';

// Everything a boot touches lives inside one fresh folder under the OS temp directory.
async function makeSandbox(migrate = true): Promise<Sandbox> {
  const root = await mkdtemp(join(tmpdir(), 'importer-boot-'));
  const box = {
    root,
    dataDir: join(root, 'data'),
    keyFile: join(root, 'keys', 'secret.key'),
    home: join(root, 'home'),
  };
  mkdirSync(box.home);
  if (migrate) expect(applyMigrations(root).status).toBe(0);
  return box;
}

let sb: Sandbox;
let lines: string[];
let handles: BootHandle[];
let exitSpy: MockInstance<typeof process.exit>;

const events = (): { level: string; message: unknown; params?: unknown[] }[] =>
  lines.map((line) => JSON.parse(line) as { level: string; message: unknown });

const eventsNamed = (name: string): { level: string; message: Record<string, unknown> }[] =>
  events().filter(
    (e): e is { level: string; message: Record<string, unknown> } =>
      typeof e.message === 'object' &&
      e.message !== null &&
      (e.message as { event?: string }).event === name,
  );

function options(
  box: Sandbox,
  env: Record<string, string> = {},
  extra: Partial<BootstrapOptions> = {},
): BootstrapOptions {
  return {
    env: { DATA_DIR: box.dataDir, SECRET_KEY_FILE: box.keyFile, ...env },
    workspaceRoot: box.root,
    home: box.home,
    sink: (line) => lines.push(line),
    port: 0,
    extraModules: [TestRoutesModule],
    ...extra,
  };
}

async function boot(
  env: Record<string, string> = {},
  extra: Partial<BootstrapOptions> = {},
  box: Sandbox = sb,
): Promise<BootHandle> {
  const handle = await bootstrap(options(box, env, extra));
  handles.push(handle);
  return handle;
}

async function failure(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  return undefined;
}

function seedKey(box: Sandbox, bytes: Buffer, mode = 0o600): void {
  mkdirSync(dirname(box.keyFile), { recursive: true, mode: 0o700 });
  writeFileSync(box.keyFile, `k1:${bytes.toString('base64')}\n`, { mode });
  chmodSync(box.keyFile, mode);
}

function formsOf(bytes: Buffer): string[] {
  const b64 = bytes.toString('base64');
  const url = bytes.toString('base64url');
  const hex = bytes.toString('hex');
  return [b64, b64.replace(/=+$/, ''), url, `${url}=`, hex, hex.toUpperCase()];
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

function refused(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port });
    socket.on('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(true));
  });
}

const dataFiles = async (box: Sandbox): Promise<string[]> =>
  (await readdir(box.dataDir).catch(() => [])).sort();

beforeEach(async () => {
  clearRegisteredSecretsForTests();
  ran.length = 0;
  lines = [];
  handles = [];
  probeForms = [];
  sb = await makeSandbox();
  // A boot must report failures by throwing; it must never end the process itself.
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit must not be called by bootstrap()');
  });
});

afterEach(async () => {
  for (const handle of handles) await handle.close();
  expect(exitSpy).not.toHaveBeenCalled();
  vi.restoreAllMocks();
  await rm(sb.root, { recursive: true, force: true });
});

describe('binding', () => {
  it('listens on the configured loopback address and reports what is really bound', async () => {
    const handle = await boot();
    expect(handle.address.address).toBe('127.0.0.1');
    expect(handle.address.port).toBeGreaterThan(0);
    const reply = await send(handle.address.port, 'GET', '/api/things');
    expect(reply.status).toBe(200);
  });

  it('listens on IPv6 loopback when asked to', async (context) => {
    const probe = await failure(() => boot({ API_HOST: '::1' }));
    if (probe instanceof BootError && probe.code === 'LISTEN_FAILED') return context.skip();
    expect(probe).toBeUndefined();
    expect(handles[0]?.address.address).toBe('::1');
  });

  it('accepts the name localhost when the socket really is loopback', async () => {
    const handle = await boot({ API_HOST: 'localhost' });
    expect(['127.0.0.1', '::1']).toContain(handle.address.address);
  });

  // The schema trusts the name `localhost`, but the resolver decides what it means. The address
  // is therefore read back from the server. The stub moves nothing onto the network: it binds
  // loopback, then makes the server report another address.
  it('closes the server and fails when the bound address is not loopback and no opt-in is set', async () => {
    let port = 0;
    const spoofed: ListenFunction = async (app) => {
      await app.listen(0, '127.0.0.1');
      const server = app.getHttpServer() as Server;
      const real = server.address() as AddressInfo;
      port = real.port;
      server.address = () => ({ ...real, address: '10.1.2.3' });
    };

    const error = await failure(() => boot({ API_HOST: 'localhost' }, { listen: spoofed }));

    expect(error).toBeInstanceOf(BootError);
    expect(error).toMatchObject({ code: 'BIND_ADDRESS_NOT_ALLOWED' });
    expect(port).toBeGreaterThan(0);
    expect(await refused(port)).toBe(true);
    expect(await dataFiles(sb)).not.toContain('importer.db-wal');
  });

  it('accepts a non-loopback bound address when the opt-in is set', async () => {
    const spoofed: ListenFunction = async (app) => {
      await app.listen(0, '127.0.0.1');
      const server = app.getHttpServer() as Server;
      const real = server.address() as AddressInfo;
      server.address = () => ({ ...real, address: '10.1.2.3' });
    };
    const handle = await boot(
      { API_HOST: '10.1.2.3', ALLOW_NON_LOOPBACK: 'true' },
      { listen: spoofed },
    );
    expect(handle.address.address).toBe('10.1.2.3');
  });

  it('reports a port that is already taken as a typed error and releases the database', async () => {
    const taken = createServer();
    await new Promise<void>((resolve) => taken.listen(0, '127.0.0.1', resolve));
    try {
      const busy = (taken.address() as AddressInfo).port;
      const error = await failure(() => boot({}, { port: busy }));
      expect(error).toBeInstanceOf(BootError);
      expect(error).toMatchObject({ code: 'LISTEN_FAILED' });
      expect(await dataFiles(sb)).not.toContain('importer.db-wal');
    } finally {
      await new Promise((resolve) => taken.close(resolve));
    }
  });

  it('stops answering after close()', async () => {
    const handle = await boot();
    const { port } = handle.address;
    await handle.close();
    handles.pop();
    expect(await refused(port)).toBe(true);
    expect(await dataFiles(sb)).not.toContain('importer.db-wal');
  });
});

describe('the opt-in for a non-loopback host', () => {
  // The listen function is injected: it records what boot asked for and binds loopback instead,
  // so no test ever opens a port on the network.
  function recordingListen(asked: { host: string; port: number; eventsSoFar: number }[]) {
    const listen: ListenFunction = async (app, port, host) => {
      asked.push({ host, port, eventsSoFar: eventsNamed('non_loopback_bind').length });
      await app.listen(0, '127.0.0.1');
    };
    return listen;
  }

  it('logs exactly one non_loopback_bind warning, before the socket call, with host and port', async () => {
    const asked: { host: string; port: number; eventsSoFar: number }[] = [];
    await boot(
      { API_HOST: '0.0.0.0', API_PORT: '4567', ALLOW_NON_LOOPBACK: 'true' },
      { listen: recordingListen(asked), port: 4567 },
    );

    expect(asked).toEqual([{ host: '0.0.0.0', port: 4567, eventsSoFar: 1 }]);
    const found = eventsNamed('non_loopback_bind');
    expect(found).toHaveLength(1);
    expect(found[0]?.level).toBe('warn');
    expect(found[0]?.message).toMatchObject({ host: '0.0.0.0', port: 4567 });
    expect(String(found[0]?.message['message'])).toMatch(/no authentication/);
  });

  it('logs nothing of the kind for a loopback host, even with the opt-in set', async () => {
    await boot({ ALLOW_NON_LOOPBACK: 'true' });
    expect(eventsNamed('non_loopback_bind')).toEqual([]);
  });

  it('refuses a non-loopback host without the opt-in before anything is created or listened on', async () => {
    const create = vi.spyOn(NestFactory, 'create');
    const asked: { host: string; port: number; eventsSoFar: number }[] = [];
    const error = await failure(() =>
      boot({ API_HOST: '0.0.0.0' }, { listen: recordingListen(asked) }),
    );
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).message).toContain('API_HOST');
    expect(asked).toEqual([]);
    expect(create).not.toHaveBeenCalled();
    expect(existsSync(sb.keyFile)).toBe(false);
  });

  // With 0.0.0.0 the guard's Host list comes from configuration only: the machine's own address
  // is rejected until the operator lists the origin it is reached by. The warning lists what is
  // accepted, so the lock-out is visible at start-up instead of showing up as 403s later.
  it('locks out every other Host until ALLOWED_ORIGINS names it, and says so at start-up', async () => {
    const env = { API_HOST: '0.0.0.0', ALLOW_NON_LOOPBACK: 'true' };
    const first = await boot(env, { listen: recordingListen([]) });
    const event = eventsNamed('non_loopback_bind')[0]?.message;
    expect(event?.['acceptedHosts']).toEqual(['0.0.0.0:3000', '127.0.0.1:5173', 'localhost:5173']);
    for (const host of ['192.168.1.5:3000', '127.0.0.1:3000']) {
      const reply = await send(first.address.port, 'GET', '/api/things', {}, host);
      expect(reply.status).toBe(403);
      expect(ApiError.parse(JSON.parse(reply.body)).error.code).toBe('HOST_NOT_ALLOWED');
    }
    await first.close();
    handles.pop();

    lines = [];
    const second = await boot(
      { ...env, ALLOWED_ORIGINS: 'http://192.168.1.5:3000' },
      { listen: recordingListen([]) },
    );
    expect(eventsNamed('non_loopback_bind')[0]?.message['acceptedHosts']).toEqual([
      '0.0.0.0:3000',
      '192.168.1.5:3000',
    ]);
    const reply = await send(second.address.port, 'GET', '/api/things', {}, '192.168.1.5:3000');
    expect(reply.status).toBe(200);
  });
});

describe('configuration is checked before anything else', () => {
  it.each([
    ['an invalid port', { API_PORT: 'abc' }, 'API_PORT'],
    ['an unknown log level', { LOG_LEVEL: 'loud' }, 'LOG_LEVEL'],
    [
      'two invalid variables',
      { API_PORT: '0', SHOPIFY_API_VERSION: 'latest' },
      'SHOPIFY_API_VERSION',
    ],
  ])(
    '%s aborts with a ConfigError naming the variable, before any app exists',
    async (_n, env, name) => {
      const create = vi.spyOn(NestFactory, 'create');
      const error = await failure(() => boot(env));
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).toContain(name);
      expect(create).not.toHaveBeenCalled();
      expect(existsSync(sb.keyFile)).toBe(false);
      expect(lines).toEqual([]);
    },
  );

  it('aborts on a malformed env file with an EnvFileError, before any app exists', async () => {
    const create = vi.spyOn(NestFactory, 'create');
    const envFile = join(sb.root, 'broken.env');
    writeFileSync(envFile, 'this line has no equals sign\n');
    const error = await failure(() => boot({}, { envFile }));
    expect(error).toBeInstanceOf(EnvFileError);
    expect(create).not.toHaveBeenCalled();
  });

  it('reads the env file from the workspace root it is given, not from the real one', async () => {
    writeFileSync(join(sb.root, '.env'), 'LOG_LEVEL=loud\n');
    const error = await failure(() => bootstrap({ ...options(sb), env: { DATA_DIR: sb.dataDir } }));
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as Error).message).toContain('LOG_LEVEL');
  });

  it('hands the parsed log level to the logger', async () => {
    await boot({ LOG_LEVEL: 'warn' });
    expect(events().every((e) => e.level === 'warn' || e.level === 'error')).toBe(true);
    lines = [];
    await boot({ LOG_LEVEL: 'debug' });
    expect(lines.length).toBeGreaterThan(0);
  });
});

describe('failures while the application is being created', () => {
  it('surface as a thrown error, never as a process abort, and leave no key or open database', async () => {
    const error = await failure(() => boot({}, { extraModules: [BrokenModule] }));
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('provider exploded');
    expect(existsSync(sb.keyFile)).toBe(false);
    expect(await dataFiles(sb)).not.toContain('importer.db-wal');
  });
});

describe('the data directory', () => {
  it('aborts with a PersistenceError naming DATA_DIR when it cannot be used, and creates no key', async () => {
    const notADirectory = join(sb.root, 'a-file');
    writeFileSync(notADirectory, 'occupied');
    const error = await failure(() => boot({ DATA_DIR: notADirectory }));
    expect(error).toBeInstanceOf(PersistenceError);
    expect(error).toMatchObject({ code: 'DATA_DIR_UNUSABLE' });
    expect((error as Error).message).toContain('DATA_DIR');
    expect(existsSync(sb.keyFile)).toBe(false);
  });
});

describe('key handling at boot', () => {
  it('generates the key on a first run, owner-only, and tells the operator to back it up once', async () => {
    await boot();
    expect(existsSync(sb.keyFile)).toBe(true);
    expect(readFileSync(sb.keyFile, 'utf8')).toMatch(/^k1:[A-Za-z0-9+/]{43}=\n?$/);
    const generated = eventsNamed('key_file_generated');
    expect(generated).toHaveLength(1);
    expect(generated[0]?.level).toBe('warn');
    expect(String(generated[0]?.message['message'])).toMatch(/back up/i);
  });

  it('uses the default location under the injected home when SECRET_KEY_FILE is not set', async () => {
    await bootstrap({
      ...options(sb),
      env: { DATA_DIR: sb.dataDir },
    }).then((handle) => handles.push(handle));
    const expected = join(sb.home, '.shopify-catalog-importer', 'secret.key');
    expect(existsSync(expected)).toBe(true);
  });

  it('does not warn again when the key already exists and matches', async () => {
    const first = await boot();
    await first.close();
    handles.pop();
    lines = [];
    await boot();
    expect(eventsNamed('key_file_generated')).toEqual([]);
  });

  it('refuses a key file readable by others before an app exists, and leaves it alone', async () => {
    const create = vi.spyOn(NestFactory, 'create');
    seedKey(sb, Buffer.alloc(32, 7), 0o644);
    const before = readFileSync(sb.keyFile);
    const error = await failure(() => boot());
    expect(error).toBeInstanceOf(BootError);
    expect(error).toMatchObject({ code: 'KEY_FILE_INVALID' });
    expect(create).not.toHaveBeenCalled();
    expect(readFileSync(sb.keyFile)).toEqual(before);
  });

  it('aborts on a key that does not match the database and never reaches listen', async () => {
    const first = await boot();
    await first.close();
    handles.pop();
    seedKey(sb, Buffer.alloc(32, 9));
    let listened = false;
    const error = await failure(() =>
      boot(
        {},
        {
          listen: async (app) => {
            listened = true;
            await app.listen(0, '127.0.0.1');
          },
        },
      ),
    );
    expect(error).toBeInstanceOf(BootError);
    expect(error).toMatchObject({ code: 'KEY_MISMATCH' });
    expect(listened).toBe(false);
    expect(await dataFiles(sb)).not.toContain('importer.db-wal');
  });

  it('aborts, and never regenerates the key, when the key file is gone but the database has its check', async () => {
    const first = await boot();
    await first.close();
    handles.pop();
    await rm(sb.keyFile);
    const error = await failure(() => boot());
    expect(error).toMatchObject({ code: 'KEY_FILE_REQUIRED' });
    expect(existsSync(sb.keyFile)).toBe(false);
  });

  it('aborts with the migration instruction, and generates no key, when the database is not migrated', async () => {
    const bare = await makeSandbox(false);
    try {
      const error = await failure(() => boot({}, {}, bare));
      expect(error).toBeInstanceOf(PersistenceError);
      expect(error).toMatchObject({ code: 'MIGRATION_REQUIRED' });
      expect((error as Error).message).toContain('pnpm db:migrate');
      expect(existsSync(bare.keyFile)).toBe(false);
    } finally {
      await rm(bare.root, { recursive: true, force: true });
    }
  });

  it('brings two simultaneous starts on one database up, with a single key-check row', async () => {
    const seeded = Buffer.alloc(32, 5);
    seedKey(sb, seeded);
    const [a, b] = await Promise.all([boot(), boot()]);
    expect(a.address.port).not.toBe(b.address.port);
    const db = new Database(databaseFilePath(sb.dataDir), { readonly: true });
    try {
      const rows = db.prepare('SELECT key FROM app_setting').all();
      expect(rows).toEqual([{ key: 'secret-key-check:k1' }]);
    } finally {
      db.close();
    }
  });
});

describe('the secret box binding', () => {
  const CANARY = 'synthetic-canary-value-0004';

  it('hands the holder to AppModule.forRoot and binds it once, with the registered keyring', async () => {
    const seeded = Buffer.alloc(32, 6);
    seedKey(sb, seeded);
    const holder = new DeferredSecretBox();
    const bind = vi.spyOn(holder, 'bind');
    const forRoot = vi.spyOn(AppModule, 'forRoot');
    await boot({}, { secretBox: holder });
    expect(forRoot.mock.calls[0]?.[0].secretBox).toBe(holder);
    expect(bind).toHaveBeenCalledTimes(1);
    const reference = new AesGcmSecretBox({ activeKeyId: 'k1', keys: new Map([['k1', seeded]]) });
    expect(holder.decrypt(reference.encrypt(CANARY, 'ctx'), 'ctx')).toBe(CANARY);
    // The key bound to the box is the one hidden from the logs.
    probeForms = formsOf(seeded);
    const handle = handles[handles.length - 1];
    await send(handle?.address.port ?? 0, 'GET', '/api/probe/log');
    for (const form of probeForms) expect(lines.join('\n')).not.toContain(form);
  });

  it('creates its own holder when none is passed, and binds the key this start generated', async () => {
    const forRoot = vi.spyOn(AppModule, 'forRoot');
    await boot();
    const box = forRoot.mock.calls[0]?.[0].secretBox;
    expect(box).toBeInstanceOf(DeferredSecretBox);
    expect(box?.decrypt(box.encrypt(CANARY, 'ctx'), 'ctx')).toBe(CANARY);
  });

  it('never binds the holder when the key does not match the database', async () => {
    const first = await boot();
    await first.close();
    handles.pop();
    seedKey(sb, Buffer.alloc(32, 9));
    const holder = new DeferredSecretBox();
    const bind = vi.spyOn(holder, 'bind');
    const error = await failure(() => boot({}, { secretBox: holder }));
    expect(error).toMatchObject({ code: 'KEY_MISMATCH' });
    expect(bind).not.toHaveBeenCalled();
    expect(() => holder.encrypt(CANARY, 'ctx')).toThrow(/not ready/);
  });
});

describe('the key never appears in log output', () => {
  async function leakCheck(bytes: Buffer): Promise<void> {
    probeForms = formsOf(bytes);
    const handle = handles[handles.length - 1];
    const reply = await send(handle?.address.port ?? 0, 'GET', '/api/probe/log');
    expect(reply.status).toBe(200);
    const output = lines.join('\n');
    expect(lines.length).toBeGreaterThan(3);
    expect(output).toContain('probe-marker');
    expect(output).toContain('probe-failure');
    expect(output).toContain('[REDACTED]');
    for (const form of probeForms) expect(output).not.toContain(form);
  }

  it('holds for a seeded key that already exists, in every textual form', async () => {
    const seeded = Buffer.from(Array.from({ length: 32 }, (_, i) => 0xf0 + (i % 16)));
    seedKey(sb, seeded);
    await boot();
    await leakCheck(seeded);
  });

  it('holds for a log line written while the application is still being created', async () => {
    const seeded = Buffer.from(Array.from({ length: 32 }, (_, i) => 0x80 + i));
    seedKey(sb, seeded);
    probeForms = formsOf(seeded);
    await boot({}, { extraModules: [EarlyLogModule] });
    const output = lines.join('\n');
    expect(output).toContain('early-marker');
    expect(output).toContain('[REDACTED]');
    for (const form of probeForms) expect(output).not.toContain(form);
  });

  it('holds for a key generated by this very start', async () => {
    await boot();
    const text = readFileSync(sb.keyFile, 'utf8').trim();
    await leakCheck(Buffer.from(text.slice(3), 'base64'));
  });
});

describe('logging', () => {
  it('routes Nest output through the redacting logger, one JSON line per event', async () => {
    await boot();
    const messages = events().map((e) => (typeof e.message === 'string' ? e.message : ''));
    expect(messages.some((m) => /Starting Nest application/.test(m))).toBe(true);
    expect(messages.some((m) => /successfully started/.test(m))).toBe(true);
    expect(lines.every((line) => line.startsWith('{') && !line.includes('\n'))).toBe(true);
  });

  it('exposes the count of events the logger had to drop', async () => {
    let broken = false;
    const handle = await boot(
      {},
      {
        sink: (line) => {
          if (broken) throw new Error('sink is gone');
          lines.push(line);
        },
      },
    );
    expect(handle.droppedEvents()).toBe(0);
    broken = true;
    probeForms = ['unused-form-value'];
    await send(handle.address.port, 'GET', '/api/probe/log');
    expect(handle.droppedEvents()).toBe(3);
  });
});

describe('routes and the CORS policy over HTTP', () => {
  let http: Sandbox;
  let handle: BootHandle;
  let port: number;

  beforeAll(async () => {
    http = await makeSandbox();
    handle = await bootstrap(options(http));
    port = handle.address.port;
  });

  afterAll(async () => {
    await handle.close();
    await rm(http.root, { recursive: true, force: true });
  });

  beforeEach(() => {
    ran.length = 0;
  });

  const preflight = (origin: string): Record<string, string> => ({
    origin,
    'access-control-request-method': 'POST',
    'access-control-request-headers': 'content-type',
  });

  it('mounts routes under the api prefix and keeps the health route at the root', async () => {
    expect((await send(port, 'GET', '/api/things')).status).toBe(200);
    expect((await send(port, 'GET', '/things')).status).toBe(404);
    expect((await send(port, 'GET', '/health')).status).toBe(200);
    expect((await send(port, 'GET', '/api/health')).status).toBe(404);
  });

  it('answers a preflight from an allow-listed origin and allows exactly that origin', async () => {
    const reply = await send(port, 'OPTIONS', '/api/guarded-test/write', preflight(ALLOWED));
    expect(reply.status).toBe(204);
    expect(reply.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(reply.headers['access-control-allow-methods']).toBe('GET,POST,PUT,PATCH,DELETE');
    expect(reply.headers['access-control-allow-credentials']).toBeUndefined();
    expect(reply.headers['vary']).toBe('Origin');
    expect(ran).toEqual([]);
  });

  it('answers a preflight from any other origin with no allow header at all', async () => {
    const reply = await send(
      port,
      'OPTIONS',
      '/api/guarded-test/write',
      preflight('https://evil.example'),
    );
    expect(reply.status).toBe(204);
    expect(Object.keys(reply.headers).filter((h) => h.startsWith('access-control-'))).toEqual([]);
    expect(reply.headers['vary']).toBe('Origin');
    expect(ran).toEqual([]);
  });

  it('runs a foreign-origin GET but gives the page no allow header to read it with', async () => {
    const reply = await send(port, 'GET', '/api/guarded-test/read', {
      origin: 'https://evil.example',
    });
    expect(reply.status).toBe(200);
    expect(ran).toEqual(['GET']);
    expect(reply.headers['access-control-allow-origin']).toBeUndefined();
    expect(reply.headers['vary']).toBe('Origin');
  });

  it('rejects a foreign-origin POST with 403 and never runs the handler', async () => {
    const reply = await send(port, 'POST', '/api/guarded-test/write', {
      origin: 'https://evil.example',
    });
    expect(reply.status).toBe(403);
    expect(ApiError.parse(JSON.parse(reply.body)).error.code).toBe('ORIGIN_NOT_ALLOWED');
    expect(reply.headers['access-control-allow-origin']).toBeUndefined();
    expect(ran).toEqual([]);
  });

  it('runs the handler for an allow-listed origin and names that origin in the answer', async () => {
    const reply = await send(port, 'POST', '/api/guarded-test/write', { origin: ALLOWED });
    expect(reply.status).toBe(201);
    expect(ran).toEqual(['POST']);
    expect(reply.headers['access-control-allow-origin']).toBe(ALLOWED);
  });

  it('runs the handler for a request with no Origin (a local client)', async () => {
    const reply = await send(port, 'POST', '/api/guarded-test/write');
    expect(reply.status).toBe(201);
    expect(ran).toEqual(['POST']);
    expect(reply.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not answer a plain OPTIONS to a write route: there is no OPTIONS handler', async () => {
    const reply = await send(port, 'OPTIONS', '/api/guarded-test/write');
    expect(reply.status).toBe(404);
    expect(ran).toEqual([]);
  });

  it('rejects a Host that is not allowed, whatever the method', async () => {
    const reply = await send(port, 'GET', '/api/things', {}, 'attacker.example:3000');
    expect(reply.status).toBe(403);
    expect(ApiError.parse(JSON.parse(reply.body)).error.code).toBe('HOST_NOT_ALLOWED');
  });
});
