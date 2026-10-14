import { afterEach, describe, expect, it, vi } from 'vitest';
import config, { resolveDevServer } from '../vite.config';

type Env = Record<string, string | undefined>;

function errorTextOf(env: Env): string {
  try {
    resolveDevServer(env);
  } catch (error) {
    return error instanceof Error ? `${error.name} ${error.message} ${error.stack ?? ''}` : '';
  }
  return '';
}

function messageOf(env: Env): string {
  try {
    resolveDevServer(env);
  } catch (error) {
    return error instanceof Error ? error.message : '';
  }
  return '';
}

function proxyEntries(env: Env = {}): [string, { target?: unknown; changeOrigin?: unknown }][] {
  return Object.entries(resolveDevServer(env).proxy ?? {}) as [
    string,
    { target?: unknown; changeOrigin?: unknown },
  ][];
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveDevServer defaults and ports', () => {
  it('binds the loopback address on the default port and refuses to move', () => {
    const server = resolveDevServer({});
    expect(server.host).toBe('127.0.0.1');
    expect(server.port).toBe(5173);
    expect(server.strictPort).toBe(true);
    expect(server.open).toBe(false);
  });

  it('reads a custom web port and keeps the strict port', () => {
    const server = resolveDevServer({ WEB_PORT: '4321' });
    expect(server.port).toBe(4321);
    expect(server.strictPort).toBe(true);
  });

  it.each(['1', '80', '65535'])('accepts the port %s', (port) => {
    expect(resolveDevServer({ WEB_PORT: port }).port).toBe(Number(port));
    expect(proxyEntries({ API_PORT: port })[0]?.[1].target).toBe(`http://127.0.0.1:${port}`);
  });

  const badPorts = [
    '',
    '0',
    '65536',
    '-1',
    '+80',
    '080',
    ' 80',
    '80 ',
    '8e3',
    '0x50',
    '80.5',
    'abc',
    '99999999999999999999',
    '８０',
  ];

  // The whole message is fixed text, so no value can be in it.
  it.each(['WEB_PORT', 'API_PORT'])('rejects every bad %s with a fixed message', (name) => {
    for (const value of badPorts) {
      expect(messageOf({ [name]: value }), value).toBe(
        `Invalid web configuration: ${name} must be a whole number from 1 to 65535.`,
      );
    }
  });
});

describe('resolveDevServer loopback rule', () => {
  it.each([
    ['127.0.0.1', '127.0.0.1'],
    ['127.0.0.2', '127.0.0.2'],
    ['127.255.255.254', '127.255.255.254'],
    ['localhost', 'localhost'],
    ['LocalHost', 'localhost'],
    ['::1', '::1'],
    ['[::1]', '::1'],
  ])('accepts the loopback WEB_HOST %s without the opt-in', (value, bound) => {
    expect(resolveDevServer({ WEB_HOST: value }).host).toBe(bound);
  });

  const outside = [
    '0.0.0.0',
    '::',
    '192.168.1.5',
    '10.0.0.1',
    'example.com',
    '127.0.0.1.evil.test',
    'localhost.evil.test',
    'sub.localhost',
    '127.1',
    '1270.0.1',
    '::ffff:127.0.0.1',
  ];

  it.each(outside)('refuses the non-loopback WEB_HOST %s without the opt-in', (value) => {
    const text = errorTextOf({ WEB_HOST: value });
    expect(text).toContain('WEB_HOST');
    expect(text).toContain('ALLOW_NON_LOOPBACK');
    expect(text).not.toContain(value);
  });

  it.each(outside)('refuses the non-loopback API_HOST %s without the opt-in', (value) => {
    const text = errorTextOf({ API_HOST: value });
    expect(text).toContain('API_HOST');
    expect(text).not.toContain(value);
  });

  it('accepts a non-loopback WEB_HOST and API_HOST with the exact opt-in', () => {
    const env = {
      WEB_HOST: '0.0.0.0',
      API_HOST: '192.168.1.5',
      ALLOW_NON_LOOPBACK: 'true',
    };
    expect(resolveDevServer(env).host).toBe('0.0.0.0');
    expect(proxyEntries(env)[0]?.[1].target).toBe('http://192.168.1.5:3000');
  });

  it.each(['TRUE', 'True', '1', 'yes', ' true', 'true ', 'on', ''])(
    'rejects the near-miss opt-in %j, with loopback and with outside hosts',
    (value) => {
      expect(errorTextOf({ ALLOW_NON_LOOPBACK: value })).toContain('ALLOW_NON_LOOPBACK');
      expect(errorTextOf({ WEB_HOST: '0.0.0.0', ALLOW_NON_LOOPBACK: value })).toContain(
        'ALLOW_NON_LOOPBACK',
      );
    },
  );

  it('treats the literal false as no opt-in', () => {
    const text = errorTextOf({ WEB_HOST: '0.0.0.0', ALLOW_NON_LOOPBACK: 'false' });
    expect(text).toContain('WEB_HOST');
  });

  it.each(['', ' ', '127.0.0.1:5173', 'http://127.0.0.1', '127.0.0.1/x', 'a b'])(
    'rejects the malformed WEB_HOST %j even with the opt-in',
    (value) => {
      expect(errorTextOf({ WEB_HOST: value, ALLOW_NON_LOOPBACK: 'true' })).toContain('WEB_HOST');
    },
  );
});

describe('resolveDevServer proxy', () => {
  it('forwards exactly the api prefix and the health route to the API', () => {
    const entries = proxyEntries({ API_HOST: '127.0.0.1', API_PORT: '3100' });
    expect(entries).toHaveLength(2);
    for (const [, options] of entries) {
      expect(options.target).toBe('http://127.0.0.1:3100');
      expect(options.changeOrigin).toBe(false);
    }
    const matches = (url: string) => entries.some(([key]) => new RegExp(key).test(url));
    for (const url of [
      '/api',
      '/api/',
      '/api/x/y',
      '/api?a=1',
      '/health',
      '/health/',
      '/health?x',
    ]) {
      expect(matches(url), url).toBe(true);
    }
    for (const url of [
      '/',
      '/index.html',
      '/apix',
      '/api-docs',
      '/healthz',
      '/xapi',
      '/@vite/client',
      '/src/main.tsx',
    ]) {
      expect(matches(url), url).toBe(false);
    }
  });

  it('builds the target from the API variables only', () => {
    const base = proxyEntries({ API_HOST: 'localhost', API_PORT: '3100' });
    const other = proxyEntries({
      API_HOST: 'localhost',
      API_PORT: '3100',
      WEB_HOST: '::1',
      WEB_PORT: '1234',
    });
    expect(base[0]?.[1].target).toBe('http://localhost:3100');
    expect(other[0]?.[1].target).toBe('http://localhost:3100');
  });

  it('brackets an IPv6 API host in the target', () => {
    expect(proxyEntries({ API_HOST: '::1' })[0]?.[1].target).toBe('http://[::1]:3000');
    expect(proxyEntries({ API_HOST: '[::1]' })[0]?.[1].target).toBe('http://[::1]:3000');
  });
});

describe('resolveDevServer safety properties', () => {
  it('keeps the host check on, CORS off and the browser closed', () => {
    for (const env of [{}, { WEB_HOST: '0.0.0.0', ALLOW_NON_LOOPBACK: 'true' }]) {
      const server = resolveDevServer(env);
      expect(server.allowedHosts).not.toBe(true);
      expect(server.cors).toBeFalsy();
      expect(server.open).toBe(false);
      expect(server.strictPort).toBe(true);
    }
  });

  it('is pure: ignores the process environment and leaves its input alone', () => {
    vi.stubEnv('WEB_PORT', '9999');
    vi.stubEnv('API_HOST', '0.0.0.0');
    const env = Object.freeze({ WEB_PORT: '4000' });
    expect(resolveDevServer(env).port).toBe(4000);
    expect(resolveDevServer({}).port).toBe(5173);
    expect(proxyEntries({})[0]?.[1].target).toBe('http://127.0.0.1:3000');
  });

  it('never echoes a value of any variable when several are invalid', () => {
    const seeded = 'seeded-odd-value';
    for (const name of ['WEB_HOST', 'WEB_PORT', 'API_HOST', 'API_PORT', 'ALLOW_NON_LOOPBACK']) {
      expect(errorTextOf({ [name]: seeded })).not.toContain(seeded);
    }
  });
});

describe('the exported Vite configuration', () => {
  it('injects nothing from the environment into the client bundle', () => {
    vi.stubEnv('WEB_HOST', undefined);
    vi.stubEnv('WEB_PORT', undefined);
    vi.stubEnv('API_HOST', undefined);
    vi.stubEnv('API_PORT', undefined);
    vi.stubEnv('ALLOW_NON_LOOPBACK', undefined);
    const resolved = config({ command: 'serve', mode: 'development' });
    expect(resolved.define).toBeUndefined();
    expect(resolved.envPrefix).toBeUndefined();
    expect(resolved.server?.port).toBe(5173);
    expect(resolved.plugins).toHaveLength(2);
  });
});
