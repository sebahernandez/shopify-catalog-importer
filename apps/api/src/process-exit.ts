import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError } from './config/env.schema.js';
import { EnvFileError } from './config/load-config.js';
import { PathError } from './config/paths.js';
import { PersistenceError } from './persistence/persistence-error.js';
import { BootError } from './shared-kernel/boot-error.js';
import { redactString } from './shared-kernel/logging/redact.js';
import { SecretBoxError } from './shared-kernel/secret-box/secret-box-error.js';

/** A start-up condition the operator can fix: bad configuration, key, database or bind. */
export const EXIT_START_FAILURE = 1;
/** Anything this program did not expect; distinct so a supervisor can tell the two apart. */
export const EXIT_UNEXPECTED = 70;

export interface FailureReport {
  readonly exitCode: number;
  /** One line, redacted, with names and reasons only. */
  readonly line: string;
}

/** The typed errors whose messages were written to be operator-facing and value-free. */
function isKnownStartFailure(error: unknown): error is Error {
  return (
    error instanceof BootError ||
    error instanceof ConfigError ||
    error instanceof EnvFileError ||
    error instanceof PathError ||
    error instanceof PersistenceError ||
    error instanceof SecretBoxError
  );
}

/**
 * Maps a start-up failure to an exit code and the one line printed for it. Pure: it neither
 * prints nor exits. A known error prints its class, its code when it has one, and its message
 * (which every one of these classes keeps free of values), passed through the redactor as a last
 * defence. An unknown error prints its class name only, because its message was never audited.
 */
export function reportFailure(error: unknown): FailureReport {
  if (isKnownStartFailure(error)) {
    const code = 'code' in error && typeof error.code === 'string' ? ` ${error.code}` : '';
    const message = error.message.replace(/\s*[\r\n]+\s*/g, '; ');
    return {
      exitCode: EXIT_START_FAILURE,
      line: redactString(`Startup failed: ${error.name}${code}: ${message}`),
    };
  }
  const name = error instanceof Error ? error.name : typeof error;
  return {
    exitCode: EXIT_UNEXPECTED,
    line: redactString(`Startup failed: unexpected error (${name}).`),
  };
}

/**
 * True when this module is the program being run and not just imported (by a test, for example).
 * The Nest CLI starts the build output without the file extension, so both spellings count.
 */
export function isMainModule(moduleUrl: string, entryPath: string | undefined): boolean {
  if (entryPath === undefined || entryPath === '') return false;
  const self = fileURLToPath(moduleUrl);
  const entry = resolve(entryPath);
  return entry === self || `${entry}.js` === self;
}
