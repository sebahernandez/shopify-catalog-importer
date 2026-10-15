import 'reflect-metadata';
import { mkdirSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { vi } from 'vitest';
import { bootstrap, type BootHandle } from '../../main.js';
import { databaseFilePath } from '../../persistence/database-location.js';
import { applyMigrations } from '../../persistence/test-support/apply-migrations.js';
import { clearRegisteredSecretsForTests } from '../../shared-kernel/logging/redact.js';
import { DeferredSecretBox } from '../../shared-kernel/secret-box/deferred-secret-box.js';
import { SimulatedShopifyGateway } from '../infrastructure/simulator/simulated-shopify-gateway.js';
import type { StoresOverrides } from '../stores.module.js';
import { parseShopDomain } from '../domain/shop-domain.js';
import { TokenAskingGateway } from './store-use-case-harness.js';

export interface Sandbox {
  readonly root: string;
  readonly dataDir: string;
  readonly keyFile: string;
  readonly home: string;
}

export interface Reply {
  readonly status: number;
  readonly body: string;
  readonly headers: Record<string, string | string[] | undefined>;
}

export interface StoreApp {
  readonly sandbox: Sandbox;
  readonly port: number;
  /** Every log line the application logger printed. */
  readonly lines: string[];
  readonly simulator: SimulatedShopifyGateway;
  readonly box: DeferredSecretBox;
  readonly handle: BootHandle;
  readonly databasePath: string;
  send(
    method: string,
    path: string,
    options?: { headers?: Record<string, string>; body?: string; json?: unknown; host?: string },
  ): Promise<Reply>;
  close(): Promise<void>;
}

export const ALLOWED_HOST = '127.0.0.1:3000';
export const ALLOWED_ORIGIN = 'http://localhost:5173';

/** A fresh migrated sandbox folder holding the data directory, the key file and the home. */
export async function makeSandbox(
  options: { migrate?: 'full' | 'baseline' } = {},
): Promise<Sandbox> {
  const root = await mkdtemp(join(tmpdir(), 'importer-stores-'));
  const box: Sandbox = {
    root,
    dataDir: join(root, 'data'),
    keyFile: join(root, 'keys', 'secret.key'),
    home: join(root, 'home'),
  };
  mkdirSync(box.home);
  const run = applyMigrations(root, { baselineOnly: options.migrate === 'baseline' });
  if (run.status !== 0) throw new Error('test sandbox migration failed');
  return box;
}

export async function removeSandbox(sandbox: Sandbox): Promise<void> {
  await rm(sandbox.root, { recursive: true, force: true });
}

export const shopDomainOf = (host: string) => {
  const parsed = parseShopDomain(host);
  if (!parsed.ok) throw new Error('bad test domain');
  return parsed.domain;
};

/** Boots the real application on a loopback ephemeral port inside `sandbox`. */
export async function bootStoreApp(
  sandbox: Sandbox,
  options: {
    overrides?: StoresOverrides;
    env?: Record<string, string>;
    logLevel?: string;
  } = {},
): Promise<StoreApp> {
  clearRegisteredSecretsForTests();
  const lines: string[] = [];
  const simulator = new SimulatedShopifyGateway();
  const box = new DeferredSecretBox();
  const handle = await bootstrap({
    env: {
      DATA_DIR: sandbox.dataDir,
      SECRET_KEY_FILE: sandbox.keyFile,
      ALLOWED_ORIGINS: ALLOWED_ORIGIN,
      LOG_LEVEL: options.logLevel ?? 'debug',
      ...options.env,
    },
    workspaceRoot: sandbox.root,
    home: sandbox.home,
    sink: (line) => lines.push(line),
    port: 0,
    secretBox: box,
    storeOverrides: options.overrides ?? {
      gateway: new TokenAskingGateway(simulator),
      // No test may reach a real host: a token exchange or a stray read fails here.
      fetchFn: () => Promise.reject(new TypeError('network access is not allowed in tests')),
    },
  });
  const { port } = handle.address;
  const send: StoreApp['send'] = (method, path, opts = {}) =>
    new Promise((resolve, reject) => {
      const body = opts.json === undefined ? opts.body : JSON.stringify(opts.json);
      const headers: Record<string, string> = { host: opts.host ?? ALLOWED_HOST, ...opts.headers };
      if (body !== undefined) {
        headers['content-type'] ??= 'application/json';
        headers['content-length'] = String(Buffer.byteLength(body));
      }
      const req = request(
        { host: '127.0.0.1', port, method, path, headers, agent: false },
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
      req.end(body);
    });
  return {
    sandbox,
    port,
    lines,
    simulator,
    box,
    handle,
    databasePath: databaseFilePath(sandbox.dataDir),
    send,
    close: () => handle.close(),
  };
}

/** `process.exit` must never end a test worker. */
export function forbidProcessExit(): void {
  vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit must not be called by bootstrap()');
  });
}
