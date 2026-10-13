import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  EnvFileError,
  loadConfig,
  schemaVariableNames,
  type LoadConfigOptions,
} from './load-config.js';
import { ConfigError } from './env.schema.js';

// Every test passes a synthetic environment, workspace root and home directory. The real
// environment, the real home directory and any real env file are never read.
let sandbox: string;
let root: string;
let home: string;

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), 'importer-config-'));
  root = join(sandbox, 'workspace');
  home = join(sandbox, 'home');
  await mkdir(root);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(sandbox, { recursive: true, force: true });
});

function load(options: LoadConfigOptions = {}) {
  return loadConfig({ env: {}, workspaceRoot: root, home, ...options });
}

async function envFile(content: string | Buffer, name = 'test.env'): Promise<string> {
  const path = join(root, name);
  await writeFile(path, content);
  return path;
}

function caught<T extends Error>(action: () => unknown, type: new (...args: never[]) => T): T {
  try {
    action();
  } catch (error) {
    if (error instanceof type) return error;
    throw error;
  }
  throw new Error(`expected ${type.name}`);
}

describe('without a file', () => {
  it('returns the schema defaults with the two paths made absolute', () => {
    const config = load();
    expect(config).toMatchObject({
      apiHost: '127.0.0.1',
      apiPort: 3000,
      shopifyApiVersion: '2026-10',
      dataDir: join(root, 'data'),
      secretKeyFile: join(home, '.shopify-catalog-importer', 'secret.key'),
    });
  });

  it('is frozen', () => {
    expect(Object.isFrozen(load())).toBe(true);
  });

  it('treats a missing env file as no file, silently', () => {
    const warn = vi.fn();
    expect(load({ envFile: join(root, 'absent.env'), warn }).apiPort).toBe(3000);
    expect(warn).not.toHaveBeenCalled();
  });

  it('reads <workspace root>/.env by default', async () => {
    await envFile('API_PORT=4100\n', '.env');
    expect(load().apiPort).toBe(4100);
  });

  it('refuses a relative env file path', () => {
    expect(caught(() => load({ envFile: 'relative.env' }), EnvFileError).code).toBe(
      'ENV_FILE_PATH',
    );
  });
});

describe('env file contents', () => {
  it('parses assignments, comments, quotes, export and CRLF line ends', async () => {
    const envFilePath = await envFile(
      '# comment\r\nAPI_PORT=4000\r\nexport WEB_PORT = 4001\r\n\r\nLOG_LEVEL="debug"\r\nDATA_DIR=\'./store\' # trailing\r\n',
    );
    expect(load({ envFile: envFilePath })).toMatchObject({
      apiPort: 4000,
      webPort: 4001,
      logLevel: 'debug',
      dataDir: join(root, 'store'),
    });
  });

  it('ignores variables the schema does not own', async () => {
    expect(load({ envFile: await envFile('OTHER_TOOL_SETTING=1\nAPI_PORT=4002\n') }).apiPort).toBe(
      4002,
    );
  });
});

describe('precedence', () => {
  it('lets a real environment variable override the file', async () => {
    const envFilePath = await envFile('API_PORT=4000\nLOG_LEVEL=debug\n');
    const config = load({ env: { API_PORT: '4500' }, envFile: envFilePath });
    expect(config.apiPort).toBe(4500);
    expect(config.logLevel).toBe('debug');
  });

  it('does not let an undefined environment entry hide a file value', async () => {
    const envFilePath = await envFile('API_PORT=4000\n');
    expect(load({ env: { API_PORT: undefined }, envFile: envFilePath }).apiPort).toBe(4000);
  });

  it('lets an empty environment value override the file, and fails like any empty value', async () => {
    const envFilePath = await envFile('API_PORT=4000\n');
    const error = caught(() => load({ env: { API_PORT: '' }, envFile: envFilePath }), ConfigError);
    expect(error.issues.map((issue) => issue.variable)).toEqual(['API_PORT']);
  });

  it('changes neither the injected environment nor the process environment', async () => {
    const marker = 'IMPORTER_TEST_MARKER_NOT_SET';
    const env = Object.freeze({ API_PORT: '4500' });
    const envFilePath = await envFile(`${marker}=1\nWEB_PORT=4001\n`);
    load({ env, envFile: envFilePath });
    expect(env).toEqual({ API_PORT: '4500' });
    expect(process.env[marker]).toBeUndefined();
    expect(process.env['WEB_PORT']).not.toBe('4001');
  });
});

describe('path resolution', () => {
  it('resolves relative paths against the workspace root, whatever the working directory', () => {
    const before = process.cwd();
    try {
      process.chdir(sandbox);
      expect(load({ env: { DATA_DIR: './db/files' } }).dataDir).toBe(join(root, 'db', 'files'));
    } finally {
      process.chdir(before);
    }
  });

  it('expands the home shorthand in SECRET_KEY_FILE from the file and from the environment', async () => {
    const envFilePath = await envFile('SECRET_KEY_FILE=~/from-file/secret.key\n');
    expect(load({ envFile: envFilePath }).secretKeyFile).toBe(
      join(home, 'from-file', 'secret.key'),
    );
    expect(load({ env: { SECRET_KEY_FILE: '~/k.key' }, envFile: envFilePath }).secretKeyFile).toBe(
      join(home, 'k.key'),
    );
  });

  it('keeps an absolute path and allows a path that leaves the workspace', () => {
    expect(load({ env: { DATA_DIR: join(sandbox, 'elsewhere') } }).dataDir).toBe(
      join(sandbox, 'elsewhere'),
    );
    expect(load({ env: { DATA_DIR: '../outside' } }).dataDir).toBe(join(sandbox, 'outside'));
  });

  it('rejects the ~name form naming SECRET_KEY_FILE, without the value', () => {
    const error = caught(
      () => load({ env: { SECRET_KEY_FILE: '~odd-account-seed/k' } }),
      ConfigError,
    );
    expect(error.issues.map((issue) => issue.variable)).toEqual(['SECRET_KEY_FILE']);
    expect(JSON.stringify(error.issues) + error.message).not.toContain('odd-account-seed');
  });

  it('creates nothing on disk', async () => {
    const { readdir } = await import('node:fs/promises');
    load({ env: { DATA_DIR: 'data', SECRET_KEY_FILE: '~/.k/secret.key' } });
    expect(await readdir(root)).toEqual([]);
    await expect(readdir(home)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

describe('invalid configuration', () => {
  it('lists every offending variable by name and never a value', async () => {
    const envFilePath = await envFile('API_PORT=file-odd-seed\n');
    const error = caught(
      () =>
        load({
          env: { LOG_LEVEL: 'env-odd-seed', SHOPIFY_API_VERSION: 'latest' },
          envFile: envFilePath,
        }),
      ConfigError,
    );
    expect(error.issues.map((issue) => issue.variable)).toEqual([
      'API_PORT',
      'SHOPIFY_API_VERSION',
      'LOG_LEVEL',
    ]);
    const dump = [
      error.message,
      error.stack,
      JSON.stringify(error),
      JSON.stringify(error.issues),
    ].join('\n');
    expect(dump).not.toContain('file-odd-seed');
    expect(dump).not.toContain('env-odd-seed');
  });

  it('does not exit the process or write to the console', () => {
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const output = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(process.stdout, 'write').mockImplementation(() => true),
      vi.spyOn(process.stderr, 'write').mockImplementation(() => true),
    ];
    caught(() => load({ env: { API_PORT: 'abc' } }), ConfigError);
    expect(exit).not.toHaveBeenCalled();
    for (const spy of output) expect(spy).not.toHaveBeenCalled();
  });
});

describe('env file problems', () => {
  const seed = 'FILE-CONTENT-SEED-9137';

  it.each([
    ['a line without an assignment', `API_PORT 4000 ${seed}\n`],
    ['a leading equals sign', `=${seed}\n`],
    ['an invalid name', `BAD-NAME=${seed}\n`],
    ['a NUL character', `API_PORT=4000\nLOG_LEVEL=${seed}\0\n`],
    ['a value that continues on the next line', `LOG_LEVEL="${seed}\nmore"\n`],
  ])('rejects %s, naming the file and never its content', async (_label, content) => {
    const path = await envFile(content);
    const error = caught(() => load({ envFile: path }), EnvFileError);
    expect(error.code).toBe('ENV_FILE_MALFORMED');
    expect(error.message).toContain(path);
    expect(error.message).not.toContain(seed);
    expect(error.stack).not.toContain(seed);
  });

  it('names the line number of a malformed line', async () => {
    const path = await envFile(`API_PORT=4000\n# fine\nnot an assignment ${seed}\n`);
    expect(caught(() => load({ envFile: path }), EnvFileError).message).toContain('line 3');
  });

  it('rejects bytes that are not valid UTF-8', async () => {
    const path = await envFile(
      Buffer.concat([Buffer.from('API_PORT=4000\nLOG_LEVEL='), Buffer.from([0xff, 0xfe])]),
    );
    const error = caught(() => load({ envFile: path }), EnvFileError);
    expect(error.code).toBe('ENV_FILE_MALFORMED');
    expect(error.message).toContain(path);
  });

  it('rejects a file larger than 64 KiB', async () => {
    const path = await envFile(`# ${'x'.repeat(65 * 1024)}\n`);
    expect(caught(() => load({ envFile: path }), EnvFileError).code).toBe('ENV_FILE_MALFORMED');
    const edge = await envFile(`#${'x'.repeat(64 * 1024 - 2)}\n`, 'edge.env');
    expect(load({ envFile: edge }).apiPort).toBe(3000);
  });

  it('reports a folder in place of the file as unreadable', async () => {
    const path = join(root, 'folder.env');
    await mkdir(path);
    const error = caught(() => load({ envFile: path }), EnvFileError);
    expect(error.code).toBe('ENV_FILE_UNREADABLE');
    expect(error.message).toContain(path);
    expect(error.message).toContain('EISDIR');
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'reports a file without read permission as unreadable, naming the reason',
    async () => {
      const path = await envFile(`API_PORT=${seed}\n`);
      await chmod(path, 0o000);
      const error = caught(() => load({ envFile: path }), EnvFileError);
      expect(error.code).toBe('ENV_FILE_UNREADABLE');
      expect(error.message).toContain(path);
      expect(error.message).toContain('EACCES');
      expect(error.message).not.toContain(seed);
    },
  );
});

describe('near-miss variable names in the env file', () => {
  it('warns by name, with the likely intended name, and never echoes a value', async () => {
    const warn = vi.fn();
    const path = await envFile(
      'api_port=value-seed-1\nAPI_PRT=value-seed-2\nWEB_PORTS=value-seed-3\n',
    );
    load({ envFile: path, warn });
    const messages = warn.mock.calls.map(([message]) => message as string);
    expect(messages).toHaveLength(3);
    // Reported in sorted name order, whatever order the parser returns them in.
    expect(messages[0]).toContain('API_PRT is not a known variable; did you mean API_PORT?');
    expect(messages[1]).toContain('WEB_PORTS is not a known variable; did you mean WEB_PORT?');
    expect(messages[2]).toContain('api_port is not a known variable; did you mean API_PORT?');
    expect(messages.join('\n')).not.toContain('value-seed');
  });

  it('covers a substituted letter and stays quiet from two edits away', async () => {
    const warn = vi.fn();
    load({ envFile: await envFile('WEB_PORX=1\nWEB_PO=1\n'), warn });
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toContain(
      'WEB_PORX is not a known variable; did you mean WEB_PORT?',
    );
  });

  it('stays quiet for exact names, unrelated names, and keys that come from the environment', async () => {
    const warn = vi.fn();
    const path = await envFile('API_PORT=4000\nOTHER_TOOL_SETTING=1\nPATH=1\n');
    load({ env: { api_prt: '1', API_PRT: '1' }, envFile: path, warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it('needs no callback', async () => {
    expect(load({ envFile: await envFile('api_port=4000\n') }).apiPort).toBe(3000);
  });
});

describe('schemaVariableNames', () => {
  it('lists the twelve names the schema reads', () => {
    expect([...schemaVariableNames()].sort()).toEqual([
      'ALLOWED_ORIGINS',
      'ALLOW_NON_LOOPBACK',
      'API_HOST',
      'API_PORT',
      'DATA_DIR',
      'LOG_LEVEL',
      'NODE_ENV',
      'SECRET_KEY_FILE',
      'SHOPIFY_API_VERSION',
      'SQLITE_BUSY_TIMEOUT_MS',
      'WEB_HOST',
      'WEB_PORT',
    ]);
  });
});
