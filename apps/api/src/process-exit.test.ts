import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { ConfigError } from './config/env.schema.js';
import { EnvFileError } from './config/load-config.js';
import { PathError } from './config/paths.js';
import { PersistenceError } from './persistence/persistence-error.js';
import { BootError } from './shared-kernel/boot-error.js';
import { clearRegisteredSecretsForTests, registerSecret } from './shared-kernel/logging/redact.js';
import { SecretBoxError } from './shared-kernel/secret-box/secret-box-error.js';
import {
  EXIT_START_FAILURE,
  EXIT_UNEXPECTED,
  isMainModule,
  reportFailure,
} from './process-exit.js';

beforeEach(() => {
  clearRegisteredSecretsForTests();
});

describe('reportFailure: one case per known error class', () => {
  const cases: [string, unknown, RegExp][] = [
    ['BootError', new BootError('KEY_MISMATCH', 'The key file does not match.'), /KEY_MISMATCH/],
    [
      'ConfigError',
      new ConfigError([{ variable: 'API_PORT', problem: 'must be a port' }]),
      /API_PORT/,
    ],
    [
      'EnvFileError',
      new EnvFileError('ENV_FILE_MALFORMED', '/work/.env', 'line 3 is bad'),
      /ENV_FILE_MALFORMED/,
    ],
    ['PathError', new PathError('PATH_EMPTY', 'The home directory is unusable.'), /PATH_/],
    [
      'PersistenceError',
      new PersistenceError('MIGRATION_REQUIRED', 'Run `pnpm db:migrate` first.'),
      /pnpm db:migrate/,
    ],
    [
      'SecretBoxError',
      new SecretBoxError('KEY_MISSING', 'No key (SECRET_KEY_FILE).'),
      /KEY_MISSING/,
    ],
  ];

  it.each(cases)(
    '%s exits 1 with a one-line message naming its class and reason',
    (name, error, reason) => {
      const report = reportFailure(error);
      expect(report.exitCode).toBe(EXIT_START_FAILURE);
      expect(EXIT_START_FAILURE).toBe(1);
      expect(report.line).toContain(name);
      expect(report.line).toMatch(reason);
      expect(report.line).not.toMatch(/[\r\n]/);
    },
  );

  it('keeps every issue of a multi-variable configuration error, on one line', () => {
    const report = reportFailure(
      new ConfigError([
        { variable: 'API_PORT', problem: 'must be a port' },
        { variable: 'LOG_LEVEL', problem: 'must be a level' },
      ]),
    );
    expect(report.line).toContain('API_PORT');
    expect(report.line).toContain('LOG_LEVEL');
    expect(report.line).not.toMatch(/[\r\n]/);
  });

  it('removes a registered secret from the message', () => {
    registerSecret('seeded-secret-value-123');
    const report = reportFailure(
      new BootError('KEY_FILE_INVALID', 'line 1 holds seeded-secret-value-123 by mistake'),
    );
    expect(report.exitCode).toBe(1);
    expect(report.line).not.toContain('seeded-secret-value-123');
    expect(report.line).toContain('[REDACTED]');
  });
});

describe('reportFailure: anything else', () => {
  it.each([
    new Error('password=hunter2-hunter2'),
    new TypeError('boom'),
    'a thrown string',
    null,
    undefined,
    { message: 'shpat_abcdef012345' },
    42,
  ])('exits with the distinct unexpected code for %o and prints no message', (thrown) => {
    const report = reportFailure(thrown);
    expect(report.exitCode).toBe(EXIT_UNEXPECTED);
    expect(EXIT_UNEXPECTED).not.toBe(0);
    expect(EXIT_UNEXPECTED).not.toBe(EXIT_START_FAILURE);
    expect(report.line).toMatch(/unexpected/i);
    expect(report.line).not.toMatch(/hunter2|shpat_|thrown string|boom/);
    expect(report.line).not.toMatch(/[\r\n]/);
  });

  it('names the class of an unexpected error and nothing else about it', () => {
    expect(reportFailure(new TypeError('x')).line).toContain('TypeError');
  });
});

describe('isMainModule', () => {
  const file = join('/work', 'apps', 'api', 'dist', 'main.js');
  const url = pathToFileURL(file).href;

  it('is true when the program was started on this very file', () => {
    expect(isMainModule(url, file)).toBe(true);
  });

  it('is true when the entry path was given without the extension (as the Nest CLI does)', () => {
    expect(isMainModule(url, file.replace(/\.js$/, ''))).toBe(true);
  });

  it('is true for a path with characters a file URL encodes', () => {
    const spaced = join('/my work', 'dist', 'main.js');
    expect(isMainModule(pathToFileURL(spaced).href, spaced)).toBe(true);
  });

  it.each([
    join('/work', 'node_modules', 'vitest', 'vitest.mjs'),
    join('/work', 'apps', 'api', 'dist', 'other.js'),
    join('/work', 'apps', 'api', 'dist', 'main.js.map'),
    '',
    undefined,
  ])('is false when the entry is %j (the file was only imported)', (entry) => {
    expect(isMainModule(url, entry)).toBe(false);
  });
});
