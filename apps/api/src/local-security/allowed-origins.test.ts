import { describe, expect, it } from 'vitest';
import { buildGuardPolicy } from './allowed-origins.js';

const DEFAULTS = {
  apiHost: '127.0.0.1',
  apiPort: 3000,
  allowedOrigins: ['http://127.0.0.1:5173', 'http://localhost:5173'],
};

const sorted = (values: ReadonlySet<string>): string[] => [...values].sort();

describe('buildGuardPolicy: allow-lists derived from configuration', () => {
  it('derives the default hosts and origins: the API itself plus the web application', () => {
    const policy = buildGuardPolicy(DEFAULTS);
    expect(sorted(policy.allowedHosts)).toEqual([
      '127.0.0.1:3000',
      '127.0.0.1:5173',
      'localhost:5173',
    ]);
    expect(sorted(policy.allowedOrigins)).toEqual([
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
    ]);
  });

  it('follows the configured API host and port, and nothing else', () => {
    const policy = buildGuardPolicy({ ...DEFAULTS, apiHost: 'localhost', apiPort: 4010 });
    expect(policy.allowedHosts.has('localhost:4010')).toBe(true);
    expect(policy.allowedOrigins.has('http://localhost:4010')).toBe(true);
    // The loopback spelling that was not configured is not added.
    expect(policy.allowedHosts.has('127.0.0.1:4010')).toBe(false);
    expect(policy.allowedHosts.has('127.0.0.1:3000')).toBe(false);
  });

  it('writes an IPv6 API host with brackets, as a Host header carries it', () => {
    const policy = buildGuardPolicy({ ...DEFAULTS, apiHost: '::1' });
    expect(policy.allowedHosts.has('[::1]:3000')).toBe(true);
    expect(policy.allowedOrigins.has('http://[::1]:3000')).toBe(true);
    expect(policy.allowedHosts.has('::1:3000')).toBe(false);
  });

  it('takes the host of an https origin and keeps its scheme in the origin list', () => {
    const policy = buildGuardPolicy({
      ...DEFAULTS,
      allowedOrigins: ['https://importer.internal.example:8443'],
    });
    expect(policy.allowedHosts.has('importer.internal.example:8443')).toBe(true);
    expect(policy.allowedOrigins.has('https://importer.internal.example:8443')).toBe(true);
    expect(policy.allowedOrigins.has('http://importer.internal.example:8443')).toBe(false);
  });

  it('omits the default port from the API host, as a browser does', () => {
    const policy = buildGuardPolicy({ ...DEFAULTS, apiPort: 80 });
    expect(policy.allowedHosts.has('127.0.0.1')).toBe(true);
    expect(policy.allowedHosts.has('127.0.0.1:80')).toBe(false);
    expect(policy.allowedOrigins.has('http://127.0.0.1')).toBe(true);
  });

  it('lists the externally used origin of a non-loopback bind only when configured', () => {
    const bound = buildGuardPolicy({ ...DEFAULTS, apiHost: '0.0.0.0' });
    expect(bound.allowedHosts.has('0.0.0.0:3000')).toBe(true);
    expect(bound.allowedHosts.has('127.0.0.1:3000')).toBe(false);
    const withOrigin = buildGuardPolicy({
      ...DEFAULTS,
      apiHost: '0.0.0.0',
      allowedOrigins: ['http://192.168.1.20:3000'],
    });
    expect(withOrigin.allowedHosts.has('192.168.1.20:3000')).toBe(true);
  });

  it('holds no wildcard and no entry that is not an exact origin or host', () => {
    const policy = buildGuardPolicy(DEFAULTS);
    for (const value of [...policy.allowedHosts, ...policy.allowedOrigins]) {
      expect(value).not.toMatch(/[*\s/]$/);
      expect(value).not.toContain('*');
    }
    expect(policy.allowedOrigins.size).toBe(3);
  });

  it.each([
    ['a trailing slash', 'http://127.0.0.1:5173/'],
    ['a path', 'http://127.0.0.1:5173/app'],
    ['upper case', 'HTTP://127.0.0.1:5173'],
    ['a default port written out', 'http://127.0.0.1:80'],
    ['userinfo', 'http://user@127.0.0.1:5173'],
    ['a wildcard', 'http://*.example'],
    ['not a URL', 'not an origin'],
    ['an empty string', ''],
    ['the null origin', 'null'],
  ])('fails closed when a configured origin has %s, without echoing it', (_label, origin) => {
    expect(() => buildGuardPolicy({ ...DEFAULTS, allowedOrigins: [origin] })).toThrowError(
      /^Local request guard: an allowed origin is not canonical\.$/,
    );
  });

  it.each([0, -1, 65536, 3000.5, Number.NaN])('fails closed on the API port %s', (apiPort) => {
    expect(() => buildGuardPolicy({ ...DEFAULTS, apiPort })).toThrowError(
      /^Local request guard: the API host or port is not usable\.$/,
    );
  });

  it.each(['bad host', 'a/b', 'user@host', 'host?x', 'host#x', ''])(
    'fails closed on the API host %j, which does not form a host',
    (apiHost) => {
      expect(() => buildGuardPolicy({ ...DEFAULTS, apiHost })).toThrowError(
        /^Local request guard: the API host or port is not usable\.$/,
      );
    },
  );
});
