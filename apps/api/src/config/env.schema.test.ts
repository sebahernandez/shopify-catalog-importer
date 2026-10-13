import { describe, expect, it } from 'vitest';
import { ConfigError, DEFAULT_SHOPIFY_API_VERSION, parseEnv } from './env.schema.js';
import type { RawEnv } from './env.schema.js';

/** Runs `parseEnv` and returns the names of the variables it rejected, in report order. */
function rejected(env: RawEnv): string[] {
  try {
    parseEnv(env);
  } catch (error) {
    if (error instanceof ConfigError) return error.issues.map((issue) => issue.variable);
    throw error;
  }
  throw new Error('expected parseEnv to throw');
}

function thrown(env: RawEnv): ConfigError {
  try {
    parseEnv(env);
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error('expected parseEnv to throw');
}

describe('defaults', () => {
  it('fills all twelve variables from an empty environment', () => {
    expect(parseEnv({})).toEqual({
      nodeEnv: 'development',
      apiHost: '127.0.0.1',
      apiPort: 3000,
      webHost: '127.0.0.1',
      webPort: 5173,
      allowNonLoopback: false,
      allowedOrigins: ['http://127.0.0.1:5173', 'http://localhost:5173'],
      shopifyApiVersion: '2026-10',
      dataDir: './data',
      secretKeyFile: '~/.shopify-catalog-importer/secret.key',
      sqliteBusyTimeoutMs: 5000,
      logLevel: 'info',
    });
  });

  it('exposes the pinned API version as the single source constant', () => {
    expect(DEFAULT_SHOPIFY_API_VERSION).toBe('2026-10');
    expect(parseEnv({}).shopifyApiVersion).toBe(DEFAULT_SHOPIFY_API_VERSION);
  });

  it('parses explicit values into typed fields', () => {
    const config = parseEnv({
      NODE_ENV: 'production',
      API_PORT: '8080',
      WEB_PORT: '4000',
      SHOPIFY_API_VERSION: '2026-07',
      DATA_DIR: '/var/lib/importer',
      SECRET_KEY_FILE: 'keys/main.key',
      SQLITE_BUSY_TIMEOUT_MS: '250',
      LOG_LEVEL: 'debug',
    });
    expect(config).toMatchObject({
      nodeEnv: 'production',
      apiPort: 8080,
      webPort: 4000,
      shopifyApiVersion: '2026-07',
      dataDir: '/var/lib/importer',
      secretKeyFile: 'keys/main.key',
      sqliteBusyTimeoutMs: 250,
      logLevel: 'debug',
    });
  });

  it('returns a frozen object with a frozen origin list', () => {
    const config = parseEnv({});
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.allowedOrigins)).toBe(true);
  });

  it('does not mutate its input', () => {
    const env = Object.freeze({ API_PORT: '8080' });
    expect(parseEnv(env).apiPort).toBe(8080);
  });
});

describe('ports', () => {
  it.each(['1', '80', '3000', '65535'])('accepts %s', (value) => {
    expect(parseEnv({ API_PORT: value }).apiPort).toBe(Number(value));
    expect(parseEnv({ WEB_PORT: value }).webPort).toBe(Number(value));
  });

  it.each([
    'abc',
    '',
    '0',
    '65536',
    '-1',
    '+80',
    '3000.5',
    '3e3',
    '0x1F90',
    '0080',
    ' 3000',
    '3000 ',
    '30 00',
    '３０００',
    'NaN',
    'Infinity',
    '99999999999999999999',
  ])('rejects %j and names the variable', (value) => {
    expect(rejected({ API_PORT: value })).toEqual(['API_PORT']);
    expect(rejected({ WEB_PORT: value })).toEqual(['WEB_PORT']);
  });

  it('rejects a non-string value passed at runtime', () => {
    const env = { API_PORT: 3000 } as unknown as RawEnv;
    expect(rejected(env)).toEqual(['API_PORT']);
  });
});

describe('enumerations', () => {
  it.each(['development', 'test', 'production'])('accepts NODE_ENV %s', (value) => {
    expect(parseEnv({ NODE_ENV: value }).nodeEnv).toBe(value);
  });

  it.each(['Production', 'prod', 'staging', '', ' test'])('rejects NODE_ENV %j', (value) => {
    expect(rejected({ NODE_ENV: value })).toEqual(['NODE_ENV']);
  });

  it.each(['error', 'warn', 'info', 'debug'])('accepts LOG_LEVEL %s', (value) => {
    expect(parseEnv({ LOG_LEVEL: value }).logLevel).toBe(value);
  });

  it.each(['trace', 'verbose', 'INFO', 'fatal', '', 'info '])('rejects LOG_LEVEL %j', (value) => {
    expect(rejected({ LOG_LEVEL: value })).toEqual(['LOG_LEVEL']);
  });
});

describe('SHOPIFY_API_VERSION', () => {
  it.each(['2026-01', '2026-04', '2026-07', '2026-10', '2030-10'])('accepts %s', (value) => {
    expect(parseEnv({ SHOPIFY_API_VERSION: value }).shopifyApiVersion).toBe(value);
  });

  it.each(['latest', 'unstable', '2026-11', '2026-1', '26-10', '2026-10-01', '2026-10 ', ''])(
    'rejects %j and names the variable',
    (value) => {
      expect(rejected({ SHOPIFY_API_VERSION: value })).toEqual(['SHOPIFY_API_VERSION']);
    },
  );
});

describe('SQLITE_BUSY_TIMEOUT_MS', () => {
  it.each(['1', '5000', '2147483647'])('accepts %s', (value) => {
    expect(parseEnv({ SQLITE_BUSY_TIMEOUT_MS: value }).sqliteBusyTimeoutMs).toBe(Number(value));
  });

  it.each(['0', '-5', '1.5', '1e3', '2147483648', '0x10', ' 5', 'abc', ''])(
    'rejects %j',
    (value) => {
      expect(rejected({ SQLITE_BUSY_TIMEOUT_MS: value })).toEqual(['SQLITE_BUSY_TIMEOUT_MS']);
    },
  );
});

describe('path variables', () => {
  it.each(['DATA_DIR', 'SECRET_KEY_FILE'])('%s rejects an empty value and a NUL byte', (name) => {
    expect(rejected({ [name]: '' })).toEqual([name]);
    expect(rejected({ [name]: 'a\0b' })).toEqual([name]);
  });

  it('passes a tilde path through untouched (expansion belongs to the loader)', () => {
    expect(parseEnv({ SECRET_KEY_FILE: '~/k/secret.key' }).secretKeyFile).toBe('~/k/secret.key');
  });
});

describe('unknown variables', () => {
  it('ignores variables the schema does not own', () => {
    const config = parseEnv({ PATH: '/usr/bin', HOME: 'x', VITE_FOO: 'y', api_port: 'abc' });
    expect(config.apiPort).toBe(3000);
  });

  it('introduces no variable that carries the secret key itself', () => {
    const config = parseEnv({ SECRET_KEY: 'AAAA', ENCRYPTION_KEY: 'AAAA', SECRET_KEY_FILE: 'k' });
    expect(Object.values(config)).not.toContain('AAAA');
  });
});

describe('aggregate failure', () => {
  it('reports every invalid variable at once, each by name', () => {
    const error = thrown({
      NODE_ENV: 'staging',
      API_PORT: 'abc',
      WEB_PORT: '70000',
      SHOPIFY_API_VERSION: 'latest',
      SQLITE_BUSY_TIMEOUT_MS: '0',
      LOG_LEVEL: 'loud',
      DATA_DIR: '',
    });
    const names = error.issues.map((issue) => issue.variable);
    expect(names).toEqual([
      'NODE_ENV',
      'API_PORT',
      'WEB_PORT',
      'SHOPIFY_API_VERSION',
      'DATA_DIR',
      'SQLITE_BUSY_TIMEOUT_MS',
      'LOG_LEVEL',
    ]);
    for (const name of names) expect(error.message).toContain(name);
  });

  it('is a typed error with a stable code', () => {
    const error = thrown({ API_PORT: 'abc' });
    expect(error.name).toBe('ConfigError');
    expect(error.code).toBe('INVALID_CONFIG');
    expect(error.issues[0]?.problem).toMatch(/1 to 65535/);
  });

  it('never echoes an offending value in the message, stack or JSON', () => {
    const seed = 'SEEDvalue-9f3a/odd value';
    const error = thrown({
      NODE_ENV: seed,
      API_PORT: seed,
      WEB_PORT: seed,
      SHOPIFY_API_VERSION: seed,
      SQLITE_BUSY_TIMEOUT_MS: seed,
      LOG_LEVEL: seed,
      DATA_DIR: `${seed}\0`,
      SECRET_KEY_FILE: `${seed}\0`,
    });
    expect(error.issues).toHaveLength(8);
    const dump = [
      error.message,
      error.stack ?? '',
      JSON.stringify(error),
      JSON.stringify(error.issues),
      String(error),
    ].join('\n');
    expect(dump).not.toContain('SEEDvalue');
    expect(dump).not.toContain('odd value');
  });
});
