import { z } from 'zod';
import type { LogLevel } from '../shared-kernel/logging/redacting-logger.js';

/** The pinned Shopify Admin GraphQL API version. The one place this literal lives. */
export const DEFAULT_SHOPIFY_API_VERSION = '2026-10';

/** Raw configuration input. The caller decides where it comes from; this module never reads it. */
export type RawEnv = Readonly<Record<string, string | undefined>>;

export type NodeEnv = 'development' | 'test' | 'production';

export interface EnvConfig {
  readonly nodeEnv: NodeEnv;
  readonly apiHost: string;
  readonly apiPort: number;
  readonly webHost: string;
  readonly webPort: number;
  readonly allowNonLoopback: boolean;
  readonly allowedOrigins: readonly string[];
  readonly shopifyApiVersion: string;
  /** Shape-checked only; relative paths are resolved by the loader. */
  readonly dataDir: string;
  /** Shape-checked only; the home directory is expanded by the loader. */
  readonly secretKeyFile: string;
  readonly sqliteBusyTimeoutMs: number;
  readonly logLevel: LogLevel;
}

export interface ConfigIssue {
  readonly variable: string;
  /** Fixed wording. Never contains the offending value. */
  readonly problem: string;
}

/**
 * Raised when one or more variables are invalid. Every issue is listed so an operator can fix a
 * broken configuration in one pass. Values are never included, because the schema cannot know
 * which variables hold sensitive data.
 */
export class ConfigError extends Error {
  readonly code = 'INVALID_CONFIG';
  readonly issues: readonly ConfigIssue[];

  constructor(issues: readonly ConfigIssue[]) {
    super(
      `Invalid configuration:\n${issues.map((i) => `- ${i.variable}: ${i.problem}`).join('\n')}`,
    );
    this.name = 'ConfigError';
    this.issues = Object.freeze([...issues]);
  }
}

const DEFAULTS = {
  NODE_ENV: 'development',
  API_HOST: '127.0.0.1',
  API_PORT: '3000',
  WEB_HOST: '127.0.0.1',
  WEB_PORT: '5173',
  ALLOW_NON_LOOPBACK: 'false',
  SHOPIFY_API_VERSION: DEFAULT_SHOPIFY_API_VERSION,
  DATA_DIR: './data',
  SECRET_KEY_FILE: '~/.shopify-catalog-importer/secret.key',
  SQLITE_BUSY_TIMEOUT_MS: '5000',
  LOG_LEVEL: 'info',
} as const;

// A Record keeps this list identical to the logger's LogLevel union in both directions.
const LOG_LEVEL_SET: Readonly<Record<LogLevel, true>> = {
  error: true,
  warn: true,
  info: true,
  debug: true,
};
const NODE_ENVS: readonly string[] = ['development', 'test', 'production'];
const SQLITE_MAX_INT = 2_147_483_647;

const text = z.string({ error: 'must be text' });
const port = text
  .regex(/^[1-9]\d{0,4}$/, 'must be an integer from 1 to 65535 written as plain digits')
  .transform(Number)
  .refine((n) => n <= 65535, 'must be an integer from 1 to 65535 written as plain digits');
const path = text
  .min(1, 'must not be empty')
  .refine((v) => !v.includes('\0'), 'must not contain a NUL character');

const schemas = {
  NODE_ENV: text.refine(
    (v) => NODE_ENVS.includes(v),
    'must be development, test or production',
  ) as z.ZodType<NodeEnv>,
  host: text.min(1, 'must not be empty'),
  port,
  flag: text
    .refine((v) => v === 'true' || v === 'false', 'must be exactly true or false')
    .transform((v) => v === 'true'),
  apiVersion: text.regex(/^\d{4}-(01|04|07|10)$/, 'must look like 2026-10 (quarterly release)'),
  path,
  busyTimeout: text
    .regex(/^[1-9]\d*$/, 'must be a positive integer written as plain digits')
    .transform(Number)
    .refine((n) => n <= SQLITE_MAX_INT, 'must not exceed 2147483647'),
  logLevel: text.refine(
    (v): v is LogLevel => Object.hasOwn(LOG_LEVEL_SET, v),
    'must be error, warn, info or debug',
  ) as z.ZodType<LogLevel>,
};

/**
 * Validates a plain key-value input into a typed, frozen configuration. Pure: no environment,
 * file, clock or logging access. Keys the schema does not own are ignored.
 */
export function parseEnv(raw: RawEnv): EnvConfig {
  const issues: ConfigIssue[] = [];

  function read<T>(name: keyof typeof DEFAULTS, schema: z.ZodType<T>): T | undefined {
    const supplied = raw[name];
    const result = schema.safeParse(supplied === undefined ? DEFAULTS[name] : supplied, {
      error: () => 'is invalid',
    });
    if (result.success) return result.data;
    issues.push({ variable: name, problem: result.error.issues[0]?.message ?? 'is invalid' });
    return undefined;
  }

  const nodeEnv = read('NODE_ENV', schemas.NODE_ENV);
  const apiHost = read('API_HOST', schemas.host);
  const apiPort = read('API_PORT', schemas.port);
  const webHost = read('WEB_HOST', schemas.host);
  const webPort = read('WEB_PORT', schemas.port);
  const allowNonLoopback = read('ALLOW_NON_LOOPBACK', schemas.flag);
  const allowedOrigins =
    raw['ALLOWED_ORIGINS'] === undefined
      ? [`http://127.0.0.1:${String(webPort)}`, `http://localhost:${String(webPort)}`]
      : raw['ALLOWED_ORIGINS'].split(',');
  const shopifyApiVersion = read('SHOPIFY_API_VERSION', schemas.apiVersion);
  const dataDir = read('DATA_DIR', schemas.path);
  const secretKeyFile = read('SECRET_KEY_FILE', schemas.path);
  const sqliteBusyTimeoutMs = read('SQLITE_BUSY_TIMEOUT_MS', schemas.busyTimeout);
  const logLevel = read('LOG_LEVEL', schemas.logLevel);

  if (issues.length > 0) throw new ConfigError(issues);

  return Object.freeze({
    nodeEnv: nodeEnv as NodeEnv,
    apiHost: apiHost as string,
    apiPort: apiPort as number,
    webHost: webHost as string,
    webPort: webPort as number,
    allowNonLoopback: allowNonLoopback as boolean,
    allowedOrigins: Object.freeze(allowedOrigins),
    shopifyApiVersion: shopifyApiVersion as string,
    dataDir: dataDir as string,
    secretKeyFile: secretKeyFile as string,
    sqliteBusyTimeoutMs: sqliteBusyTimeoutMs as number,
    logLevel: logLevel as LogLevel,
  });
}
