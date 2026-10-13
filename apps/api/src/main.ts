import 'reflect-metadata';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication, LoggerService, ModuleMetadata } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { AppConfig, LoadConfigOptions } from './config/load-config.js';
import { loadConfig } from './config/load-config.js';
import type { RawEnv } from './config/env.schema.js';
import { loadKeyring, reconcileKey, registerKeyring } from './key-boot.js';
import { buildGuardPolicy } from './local-security/allowed-origins.js';
import { nonLoopbackBindEvent, verifyBoundAddress } from './local-security/bind-policy.js';
import { createCorsMiddleware } from './local-security/cors-middleware.js';
import { KEY_CHECK_STORE, PRISMA_SERVICE } from './persistence/persistence.module.js';
import type { PrismaService } from './persistence/prisma.service.js';
import { isMainModule, reportFailure } from './process-exit.js';
import { BootError } from './shared-kernel/boot-error.js';
import { RedactingLogger } from './shared-kernel/logging/redacting-logger.js';
import { FileKeyProvider } from './shared-kernel/secret-box/infrastructure/file-key-provider.js';
import type { KeyCheckStore } from './shared-kernel/secret-box/key-check-store.port.js';

// Compile-time check, carried over from the logger unit: the kernel cannot import NestJS, so this
// is the one place that proves `RedactingLogger` is still assignable to Nest's `LoggerService`.
// It is evaluated by `tsc`, never at run time.
type AssertAssignable<Actual extends LoggerService> = Actual;
export type RedactingLoggerIsALoggerService = AssertAssignable<RedactingLogger>;

/** Starts listening. Tests inject one that never binds a non-loopback address. */
export type ListenFunction = (
  app: INestApplication,
  port: number,
  host: string,
) => Promise<unknown>;

export interface BootstrapOptions {
  /** The environment. Defaults to the real one (read by the configuration loader). */
  readonly env?: RawEnv;
  /** Folder holding the env file and the base for relative paths. Defaults to the repository. */
  readonly workspaceRoot?: string;
  /** Absolute path of the env file. Defaults to the one in the workspace root. */
  readonly envFile?: string;
  /** Home directory used to expand `~`. Defaults to the current user's. */
  readonly home?: string;
  /** Receives one finished JSON log line. Defaults to standard output. */
  readonly sink?: (line: string) => void;
  /** Listens here instead of `API_PORT`; `0` picks a free port. */
  readonly port?: number;
  /** Test seam: modules to add to the application. `main.ts` never passes any. */
  readonly extraModules?: NonNullable<ModuleMetadata['imports']>;
  /** Test seam: replaces the `listen(port, host)` call. */
  readonly listen?: ListenFunction;
}

export interface BootHandle {
  /** The address the server is really bound to, read back from the server itself. */
  readonly address: AddressInfo;
  /** How many log events the logger had to drop because its sink failed. */
  droppedEvents(): number;
  close(): Promise<void>;
}

const writeToStdout = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

const defaultListen: ListenFunction = (app, port, host) => app.listen(port, host);

function loadOptionsOf(options: BootstrapOptions, hints: string[]): LoadConfigOptions {
  return {
    ...(options.env !== undefined && { env: options.env }),
    ...(options.workspaceRoot !== undefined && { workspaceRoot: options.workspaceRoot }),
    ...(options.envFile !== undefined && { envFile: options.envFile }),
    ...(options.home !== undefined && { home: options.home }),
    warn: (message) => hints.push(message),
  };
}

async function listenOrFail(
  listen: ListenFunction,
  app: INestApplication,
  port: number,
  host: string,
): Promise<void> {
  try {
    await listen(app, port, host);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    throw new BootError(
      'LISTEN_FAILED',
      `Could not listen on ${host}:${port}${typeof code === 'string' ? ` (${code})` : ''}.`,
    );
  }
}

/**
 * The ordered start-up (design D4, D6, D7 and the boot diagram). Every input from the outside is a
 * parameter, it never exits the process, and it throws a typed error for every start-up failure.
 *
 * 1. Load and validate the configuration, before any application exists.
 * 2. Build the redacting logger with the parsed log level.
 * 3. Read the key file (a bad file stops here) and register a key that already exists.
 * 4. Create the application with the logger. `abortOnError: false` turns a Nest failure into a
 *    thrown error; by default Nest would abort the process.
 * 5. Connect the database, then reconcile the key against its check record, then register the
 *    key (a generated one included) with the redactor.
 * 6. Apply CORS and the global prefix, then listen on the configured host and port.
 * 7. Read the bound address back from the server and refuse a non-loopback one without opt-in.
 *
 * Anything that fails after step 4 closes the application first (and with it the server and the
 * database connection) and rethrows.
 */
export async function bootstrap(options: BootstrapOptions = {}): Promise<BootHandle> {
  const hints: string[] = [];
  const config: AppConfig = loadConfig(loadOptionsOf(options, hints));

  const logger = new RedactingLogger({
    sink: options.sink ?? writeToStdout,
    level: config.logLevel,
  });
  for (const hint of hints) logger.warn(hint);

  const keyProvider = new FileKeyProvider({
    keyFilePath: config.secretKeyFile,
    warn: (message) => logger.warn(message),
  });
  const existingKey = loadKeyring(keyProvider);
  if (existingKey) registerKeyring(existingKey);

  const app = await NestFactory.create(
    AppModule.forRoot({
      config,
      logger,
      ...(options.extraModules !== undefined && { extraModules: options.extraModules }),
    }),
    { logger, abortOnError: false },
  );

  try {
    await app.get<PrismaService>(PRISMA_SERVICE).connect();
    const { keyring, outcome } = await reconcileKey(
      keyProvider,
      app.get<KeyCheckStore>(KEY_CHECK_STORE),
    );
    registerKeyring(keyring);
    if (outcome === 'generated') {
      logger.warn({
        event: 'key_file_generated',
        message:
          'A new secret key was generated. Back up the key file now: without it the encrypted ' +
          'secrets in the database cannot be recovered.',
      });
    }

    app.use(createCorsMiddleware(config.allowedOrigins));
    app.setGlobalPrefix('api', { exclude: ['health'] });

    const port = options.port ?? config.apiPort;
    const bindEvent = nonLoopbackBindEvent({
      host: config.apiHost,
      port,
      allowNonLoopback: config.allowNonLoopback,
      acceptedHosts: buildGuardPolicy({
        apiHost: config.apiHost,
        apiPort: config.apiPort,
        allowedOrigins: config.allowedOrigins,
      }).allowedHosts,
    });
    if (bindEvent) logger.warn(bindEvent);

    await listenOrFail(options.listen ?? defaultListen, app, port, config.apiHost);
    const address = verifyBoundAddress(
      (app.getHttpServer() as Server).address(),
      config.allowNonLoopback,
    );

    return {
      address,
      droppedEvents: () => logger.droppedEvents,
      close: () => app.close(),
    };
  } catch (error) {
    await app.close().catch(() => undefined);
    throw error;
  }
}

async function run(): Promise<void> {
  try {
    const handle = await bootstrap();
    const stop = (): void => {
      handle.close().then(
        () => process.exit(0),
        () => process.exit(1),
      );
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    const report = reportFailure(error);
    process.stderr.write(`${report.line}\n`);
    process.exit(report.exitCode);
  }
}

// Runs only when this file is the program (`node dist/main.js`, or the Nest CLI), never when a
// test imports it. It reads the real environment and nothing else.
if (isMainModule(import.meta.url, process.argv[1])) void run();
