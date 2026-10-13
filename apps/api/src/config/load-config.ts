import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { parseEnv as parseEnvFileContent } from 'node:util';
import {
  ConfigError,
  parseEnv,
  type ConfigIssue,
  type EnvConfig,
  type RawEnv,
} from './env.schema.js';
import { PathError, findWorkspaceRoot, resolveConfigPath } from './paths.js';

/** The validated configuration. `dataDir` and `secretKeyFile` are absolute and normalised. */
export type AppConfig = EnvConfig;

export type EnvFileErrorCode = 'ENV_FILE_PATH' | 'ENV_FILE_UNREADABLE' | 'ENV_FILE_MALFORMED';

/**
 * Raised when the env file exists but cannot be used. The message names the file and the reason
 * (an error code or a line number). It never holds the file's content, and there is no `cause`.
 */
export class EnvFileError extends Error {
  readonly code: EnvFileErrorCode;

  constructor(code: EnvFileErrorCode, path: string, reason: string) {
    super(`Environment file ${path}: ${reason}`);
    this.name = 'EnvFileError';
    this.code = code;
  }
}

export interface LoadConfigOptions {
  /** The real environment. Defaults to `process.env`; tests pass a synthetic object. */
  readonly env?: RawEnv;
  /** Absolute. Defaults to `.env` in the workspace root. A missing file is not an error. */
  readonly envFile?: string;
  /** Absolute. Defaults to the nearest folder above this module holding `pnpm-workspace.yaml`. */
  readonly workspaceRoot?: string;
  /** Absolute. Defaults to the current user's home directory. */
  readonly home?: string;
  /** Receives fixed-text hints about misspelled names. The loader never logs by itself. */
  readonly warn?: (message: string) => void;
}

const MAX_ENV_FILE_BYTES = 64 * 1024;
// Blank, a comment, or [export] NAME=anything. Multi-line values are not supported on purpose:
// no variable needs one, and the parser would otherwise skip a broken line without a word.
const ENV_FILE_LINE = /^\s*(?:#.*|(?:export\s+)?[A-Za-z_][A-Za-z0-9_]*\s*=.*)?$/;
const UTF8 = new TextDecoder('utf-8', { fatal: true });

let cachedNames: readonly string[] | undefined;

/**
 * The variable names the schema reads, discovered by running it against an environment that
 * records every lookup. This keeps the name list in one place (the schema) and cannot drift.
 */
export function schemaVariableNames(): readonly string[] {
  if (cachedNames) return cachedNames;
  const names = new Set<string>();
  parseEnv(
    new Proxy<Record<string, string | undefined>>(
      {},
      {
        get(_target, key) {
          if (typeof key === 'string') names.add(key);
          return undefined;
        },
      },
    ),
  );
  cachedNames = [...names];
  return cachedNames;
}

/** Reads the env file as `NAME -> value`. Absent means empty; anything else wrong is an error. */
function readEnvFile(path: string): RawEnv {
  if (!isAbsolute(path))
    throw new EnvFileError('ENV_FILE_PATH', path, 'the path must be absolute.');

  let bytes: Buffer;
  try {
    bytes = readFileSync(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return {};
    throw new EnvFileError(
      'ENV_FILE_UNREADABLE',
      path,
      `could not be read (${code ?? 'unknown error'}).`,
    );
  }
  if (bytes.length > MAX_ENV_FILE_BYTES) {
    throw new EnvFileError('ENV_FILE_MALFORMED', path, `larger than ${MAX_ENV_FILE_BYTES} bytes.`);
  }

  let text: string;
  try {
    text = UTF8.decode(bytes);
  } catch {
    throw new EnvFileError('ENV_FILE_MALFORMED', path, 'not valid UTF-8 text.');
  }
  if (text.includes('\0'))
    throw new EnvFileError('ENV_FILE_MALFORMED', path, 'contains a NUL character.');

  const badLine = text.split(/\r?\n/).findIndex((line) => !ENV_FILE_LINE.test(line));
  if (badLine !== -1) {
    throw new EnvFileError(
      'ENV_FILE_MALFORMED',
      path,
      `line ${badLine + 1} is not a comment, a blank line or NAME=value.`,
    );
  }
  return { ...parseEnvFileContent(text) };
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const restA = a.slice(i + (a.length >= b.length ? 1 : 0));
  const restB = b.slice(i + (b.length >= a.length ? 1 : 0));
  return restA === restB;
}

/** A name in the file that is not a variable but is one letter-case or one edit away from one. */
function warnAboutNearMisses(
  fileValues: RawEnv,
  path: string,
  warn: (message: string) => void,
): void {
  const known = schemaVariableNames();
  for (const name of Object.keys(fileValues).sort()) {
    if (known.includes(name)) continue;
    const likely = known.find((candidate) => editDistanceAtMostOne(name.toUpperCase(), candidate));
    if (likely)
      warn(`Environment file ${path}: ${name} is not a known variable; did you mean ${likely}?`);
  }
}

/**
 * Builds the configuration: the env file first, the real environment on top of it (a variable set
 * in the environment always wins), validated by the schema, then the two path variables resolved.
 * Nothing is written anywhere, nothing is created, `process.env` is not changed, and the process
 * is never exited or logged to. The caller decides how to report a thrown `ConfigError`,
 * `EnvFileError` or `PathError`.
 */
export function loadConfig(options: LoadConfigOptions = {}): AppConfig {
  const workspaceRoot = options.workspaceRoot ?? findWorkspaceRoot();
  const envFile = options.envFile ?? join(workspaceRoot, '.env');

  const fileValues = readEnvFile(envFile);
  if (options.warn) warnAboutNearMisses(fileValues, envFile, options.warn);

  const merged: Record<string, string | undefined> = { ...fileValues };
  for (const [name, value] of Object.entries(options.env ?? process.env)) {
    if (value !== undefined) merged[name] = value;
  }
  const parsed = parseEnv(merged);

  const issues: ConfigIssue[] = [];
  const context = { workspaceRoot, home: options.home ?? homedir() };
  function resolveVariable(variable: string, value: string): string {
    try {
      return resolveConfigPath(value, context);
    } catch (error) {
      if (!(error instanceof PathError)) throw error;
      issues.push({ variable, problem: error.message });
      return value;
    }
  }
  const dataDir = resolveVariable('DATA_DIR', parsed.dataDir);
  const secretKeyFile = resolveVariable('SECRET_KEY_FILE', parsed.secretKeyFile);
  if (issues.length > 0) throw new ConfigError(issues);

  return Object.freeze({ ...parsed, dataDir, secretKeyFile });
}
