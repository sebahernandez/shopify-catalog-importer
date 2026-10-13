import { isIPv4, isIPv6 } from 'node:net';
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

const ORDER: readonly string[] = [
  ...Object.keys(DEFAULTS).slice(0, 6),
  'ALLOWED_ORIGINS',
  ...Object.keys(DEFAULTS).slice(6),
];

interface ParsedHost {
  /** Bind-ready form: lowercase, without brackets. */
  readonly host: string;
  readonly loopback: boolean;
}

const HOST_PROBLEM = 'must be an IPv4 address, an IPv6 address or a hostname';
const HOSTNAME_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** IPv6 loopback is exactly ::1 in any spelling; IPv4-mapped forms are deliberately not accepted. */
function isIpv6Loopback(address: string): boolean {
  try {
    return new URL(`http://[${address}]`).hostname === '[::1]';
  } catch {
    return false;
  }
}

function isHostname(value: string): boolean {
  const name = value.endsWith('.') ? value.slice(0, -1) : value;
  const labels = name.split('.');
  const last = labels[labels.length - 1] ?? '';
  return (
    name.length <= 253 && labels.every((label) => HOSTNAME_LABEL.test(label)) && !/^\d+$/.test(last)
  );
}

/**
 * Loopback means 127.0.0.0/8, ::1 or the name localhost. Everything else that is a valid host is
 * non-loopback, including 0.0.0.0, :: and look-alike names. `localhost` is trusted by name, as the
 * design lists it: the resolver can remap it, which this pure check cannot see.
 */
function parseHost(value: string): ParsedHost | undefined {
  const bracketed = value.startsWith('[') && value.endsWith(']');
  const inner = bracketed ? value.slice(1, -1) : value;
  if (isIPv6(inner)) return { host: inner, loopback: isIpv6Loopback(inner) };
  if (bracketed) return undefined;
  if (isIPv4(value)) return { host: value, loopback: value.startsWith('127.') };
  const lower = value.toLowerCase();
  if (!isHostname(lower)) return undefined;
  return { host: lower, loopback: lower === 'localhost' };
}

function isCanonicalOrigin(entry: string): boolean {
  if (entry.includes('*')) return false;
  try {
    const url = new URL(entry);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === entry;
  } catch {
    return false;
  }
}

/** Entries are trimmed (spaces and tabs), must be canonical origins, and are de-duplicated. */
function parseOrigins(value: string): string[] | undefined {
  const entries = value.split(',').map((entry) => entry.replace(/^[ \t]+|[ \t]+$/g, ''));
  return entries.every(isCanonicalOrigin) ? [...new Set(entries)] : undefined;
}

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
  host: text.transform((value, ctx) => {
    const parsed = parseHost(value);
    if (parsed === undefined) ctx.addIssue({ code: 'custom', message: HOST_PROBLEM });
    return parsed ?? z.NEVER;
  }),
  origins: text.transform((value, ctx) => {
    const parsed = parseOrigins(value);
    if (parsed === undefined) {
      ctx.addIssue({
        code: 'custom',
        message:
          'must be a comma-separated list of exact origins such as http://localhost:5173 (no path, wildcard or credentials)',
      });
    }
    return parsed ?? z.NEVER;
  }),
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

function derivedOrigins(webPort: number | undefined): string[] | undefined {
  return webPort === undefined
    ? undefined
    : [`http://127.0.0.1:${String(webPort)}`, `http://localhost:${String(webPort)}`];
}

/**
 * Validates a plain key-value input into a typed, frozen configuration. Pure: no environment,
 * file, clock or logging access. Keys the schema does not own are ignored.
 */
export function parseEnv(raw: RawEnv): EnvConfig {
  const issues: ConfigIssue[] = [];

  function check<T>(name: string, schema: z.ZodType<T>, input: unknown): T | undefined {
    const result = schema.safeParse(input, { error: () => 'is invalid' });
    if (result.success) return result.data;
    issues.push({ variable: name, problem: result.error.issues[0]?.message ?? 'is invalid' });
    return undefined;
  }

  function read<T>(name: keyof typeof DEFAULTS, schema: z.ZodType<T>): T | undefined {
    return check(name, schema, raw[name] ?? DEFAULTS[name]);
  }

  /** A host is judged against the opt-in only when the opt-in itself is valid and true. */
  function checkBind(name: string, host: ParsedHost | undefined, optIn: boolean | undefined) {
    if (host === undefined || host.loopback || optIn === true) return;
    issues.push({
      variable: name,
      problem: 'is not a loopback address; set ALLOW_NON_LOOPBACK=true to bind it on purpose',
    });
  }

  const nodeEnv = read('NODE_ENV', schemas.NODE_ENV);
  const apiHost = read('API_HOST', schemas.host);
  const apiPort = read('API_PORT', schemas.port);
  const webHost = read('WEB_HOST', schemas.host);
  const webPort = read('WEB_PORT', schemas.port);
  const allowNonLoopback = read('ALLOW_NON_LOOPBACK', schemas.flag);
  const suppliedOrigins = raw['ALLOWED_ORIGINS'];
  const allowedOrigins =
    suppliedOrigins === undefined
      ? derivedOrigins(webPort)
      : check('ALLOWED_ORIGINS', schemas.origins, suppliedOrigins);
  const shopifyApiVersion = read('SHOPIFY_API_VERSION', schemas.apiVersion);
  const dataDir = read('DATA_DIR', schemas.path);
  const secretKeyFile = read('SECRET_KEY_FILE', schemas.path);
  const sqliteBusyTimeoutMs = read('SQLITE_BUSY_TIMEOUT_MS', schemas.busyTimeout);
  const logLevel = read('LOG_LEVEL', schemas.logLevel);
  checkBind('API_HOST', apiHost, allowNonLoopback);
  checkBind('WEB_HOST', webHost, allowNonLoopback);

  if (issues.length > 0) {
    throw new ConfigError(
      issues.sort((a, b) => ORDER.indexOf(a.variable) - ORDER.indexOf(b.variable)),
    );
  }

  // With no issues recorded, every value above is defined; the casts only narrow that.
  return Object.freeze({
    nodeEnv: nodeEnv as NodeEnv,
    apiHost: (apiHost as ParsedHost).host,
    apiPort: apiPort as number,
    webHost: (webHost as ParsedHost).host,
    webPort: webPort as number,
    allowNonLoopback: allowNonLoopback as boolean,
    allowedOrigins: Object.freeze(allowedOrigins as string[]),
    shopifyApiVersion: shopifyApiVersion as string,
    dataDir: dataDir as string,
    secretKeyFile: secretKeyFile as string,
    sqliteBusyTimeoutMs: sqliteBusyTimeoutMs as number,
    logLevel: logLevel as LogLevel,
  });
}
