import { describe, expect, it } from 'vitest';
import { buildGuardPolicy } from './allowed-origins.js';
import { evaluateRequest, type GuardDecision, type RequestFacts } from './request-policy.js';

const policy = buildGuardPolicy({
  apiHost: '127.0.0.1',
  apiPort: 3000,
  allowedOrigins: ['http://127.0.0.1:5173', 'http://localhost:5173'],
});

const ALLOW: GuardDecision = { allowed: true };
const HOST: GuardDecision = { allowed: false, code: 'HOST_NOT_ALLOWED' };
const ORIGIN: GuardDecision = { allowed: false, code: 'ORIGIN_NOT_ALLOWED' };

const OWN_HOST = '127.0.0.1:3000';

const facts = (over: Partial<RequestFacts> = {}): RequestFacts => ({
  method: 'POST',
  host: OWN_HOST,
  origin: undefined,
  secFetchSite: undefined,
  ...over,
});

describe('evaluateRequest: Host (rule 1, every method)', () => {
  it.each(['127.0.0.1:3000', '127.0.0.1:5173', 'localhost:5173'])('accepts %s', (host) => {
    expect(evaluateRequest(policy, facts({ method: 'GET', host }))).toEqual(ALLOW);
  });

  it.each([
    ['a missing Host', undefined],
    ['an empty Host', ''],
    ['a different case', 'LOCALHOST:5173'],
    ['a trailing dot', 'localhost.:5173'],
    ['an explicit default port', '127.0.0.1:80'],
    ['a missing port', '127.0.0.1'],
    ['a wrong port', '127.0.0.1:3001'],
    ['userinfo', 'user@127.0.0.1:3000'],
    ['userinfo that looks like the host', '127.0.0.1:3000@evil.test'],
    ['a path', '127.0.0.1:3000/'],
    ['a path that embeds the host', 'evil.test/127.0.0.1:3000'],
    ['leading whitespace', ' 127.0.0.1:3000'],
    ['trailing whitespace', '127.0.0.1:3000 '],
    ['a tab', '127.0.0.1:3000\t'],
    ['a prefix match', '127.0.0.1:3000.evil.test'],
    ['a suffix match', 'evil.test127.0.0.1:3000'],
    ['an embedded match', 'x127.0.0.1:3000x'],
    ['a look-alike name', '127.0.0.1.evil.test:3000'],
    ['a look-alike localhost', 'localhost.attacker.example:5173'],
    ['two values joined by a comma', '127.0.0.1:3000, evil.test'],
    ['two values as a list', ['127.0.0.1:3000', '127.0.0.1:3000']],
    ['an IPv6 literal that is not configured', '[::1]:3000'],
    ['an IPv4-mapped IPv6 form', '[::ffff:127.0.0.1]:3000'],
    ['an IPv4-mapped IPv6 form in hex', '[::ffff:7f00:1]:3000'],
    ['a decimal IPv4 spelling', '2130706433:3000'],
    ['a wildcard', '*'],
    ['null text', 'null'],
  ])('rejects %s with HOST_NOT_ALLOWED', (_label, host) => {
    expect(evaluateRequest(policy, facts({ method: 'GET', host }))).toEqual(HOST);
  });
});

describe('evaluateRequest: Origin and Sec-Fetch-Site (rules 2 and 3, non-safe methods)', () => {
  it.each([
    ['the API origin', 'http://127.0.0.1:3000'],
    ['the web origin by address', 'http://127.0.0.1:5173'],
    ['the web origin by name', 'http://localhost:5173'],
  ])('accepts %s', (_label, origin) => {
    expect(evaluateRequest(policy, facts({ origin }))).toEqual(ALLOW);
  });

  it.each([
    ['a foreign origin', 'https://evil.example'],
    ['the null origin', 'null'],
    ['an empty origin', ''],
    ['a different scheme', 'https://127.0.0.1:5173'],
    ['a default port written out', 'http://127.0.0.1:80'],
    ['a different port', 'http://127.0.0.1:5174'],
    ['a trailing slash', 'http://127.0.0.1:5173/'],
    ['a different case', 'http://LOCALHOST:5173'],
    ['an upper-case scheme', 'HTTP://localhost:5173'],
    ['a prefix match', 'http://localhost:5173.evil.test'],
    ['a suffix match', 'http://evil.testlocalhost:5173'],
    ['userinfo', 'http://localhost:5173@evil.test'],
    ['a path', 'http://localhost:5173/x'],
    ['whitespace', ' http://localhost:5173'],
    ['two values joined by a comma', 'http://localhost:5173, https://evil.example'],
    ['two values as a list', ['http://localhost:5173', 'http://localhost:5173']],
    ['a wildcard', '*'],
  ])('rejects %s with ORIGIN_NOT_ALLOWED', (_label, origin) => {
    expect(evaluateRequest(policy, facts({ origin }))).toEqual(ORIGIN);
  });

  it('does not let Sec-Fetch-Site rescue a bad Origin: the header is not authentication', () => {
    for (const secFetchSite of ['same-origin', 'none', 'same-site', 'cross-site', undefined]) {
      expect(
        evaluateRequest(policy, facts({ origin: 'https://evil.example', secFetchSite })),
      ).toEqual(ORIGIN);
      expect(evaluateRequest(policy, facts({ origin: 'null', secFetchSite }))).toEqual(ORIGIN);
    }
  });

  it('lets an allowed Origin through whatever Sec-Fetch-Site says, as CORS from the web app needs', () => {
    // localhost:5173 calling 127.0.0.1:3000 is cross-site in a browser, and must still work.
    for (const secFetchSite of ['cross-site', 'same-site', 'same-origin', 'none', 'garbage']) {
      expect(
        evaluateRequest(policy, facts({ origin: 'http://localhost:5173', secFetchSite })),
      ).toEqual(ALLOW);
    }
  });

  it.each([
    ['absent', undefined, ALLOW],
    ['same-origin', 'same-origin', ALLOW],
    ['none', 'none', ALLOW],
    ['same-site', 'same-site', ORIGIN],
    ['cross-site', 'cross-site', ORIGIN],
    ['garbage', 'banana', ORIGIN],
    ['empty', '', ORIGIN],
    ['upper case', 'SAME-ORIGIN', ORIGIN],
    ['padded', ' none', ORIGIN],
    ['two values', ['none', 'none'], ORIGIN],
    ['a list with a joined value', 'none, cross-site', ORIGIN],
  ])('with no Origin and Sec-Fetch-Site %s', (_label, secFetchSite, expected) => {
    expect(evaluateRequest(policy, facts({ secFetchSite }))).toEqual(expected);
  });
});

describe('evaluateRequest: methods', () => {
  it.each(['GET', 'HEAD', 'OPTIONS'])('%s skips rules 2 and 3 but not rule 1', (method) => {
    const hostile = { origin: 'https://evil.example', secFetchSite: 'cross-site' };
    expect(evaluateRequest(policy, facts({ method, ...hostile }))).toEqual(ALLOW);
    expect(evaluateRequest(policy, facts({ method, ...hostile, host: 'evil.test' }))).toEqual(HOST);
  });

  it.each([
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'TRACE',
    'CONNECT',
    'PROPFIND',
    'get',
    'Get',
    'options',
    '',
    ' GET',
    'GET ',
  ])('treats %j as state-changing: a foreign Origin is rejected', (method) => {
    expect(evaluateRequest(policy, facts({ method, origin: 'https://evil.example' }))).toEqual(
      ORIGIN,
    );
    expect(evaluateRequest(policy, facts({ method, secFetchSite: 'cross-site' }))).toEqual(ORIGIN);
    expect(evaluateRequest(policy, facts({ method, origin: 'http://localhost:5173' }))).toEqual(
      ALLOW,
    );
  });

  it('treats a method that is not a string as state-changing, without throwing', () => {
    const odd = { method: undefined as unknown as string };
    expect(evaluateRequest(policy, facts({ ...odd, origin: 'https://evil.example' }))).toEqual(
      ORIGIN,
    );
  });
});

describe('evaluateRequest: the whole matrix', () => {
  // Each value carries the class the rules give it, so the expectation is stated per class and
  // not recomputed with the production logic.
  const methods = [
    { value: 'GET', safe: true },
    { value: 'HEAD', safe: true },
    { value: 'OPTIONS', safe: true },
    { value: 'POST', safe: false },
    { value: 'PUT', safe: false },
    { value: 'PATCH', safe: false },
    { value: 'DELETE', safe: false },
    { value: 'TRACE', safe: false },
    { value: 'get', safe: false },
  ];
  const hosts = [
    { value: OWN_HOST, ok: true },
    { value: 'localhost:5173', ok: true },
    { value: 'evil.test', ok: false },
    { value: '127.0.0.1:3000.evil.test', ok: false },
    { value: undefined, ok: false },
  ];
  const origins = [
    { value: undefined, kind: 'absent' },
    { value: 'http://127.0.0.1:3000', kind: 'allowed' },
    { value: 'http://localhost:5173', kind: 'allowed' },
    { value: 'https://evil.example', kind: 'bad' },
    { value: 'null', kind: 'bad' },
    { value: '', kind: 'bad' },
    { value: ['http://localhost:5173', 'http://localhost:5173'], kind: 'bad' },
  ];
  const sites = [
    { value: undefined, quiet: true },
    { value: 'same-origin', quiet: true },
    { value: 'none', quiet: true },
    { value: 'same-site', quiet: false },
    { value: 'cross-site', quiet: false },
    { value: 'garbage', quiet: false },
  ];

  const cells = methods.flatMap((m) =>
    hosts.flatMap((h) =>
      origins.flatMap((o) =>
        sites.map((s) => {
          let expected: GuardDecision;
          if (!h.ok) expected = HOST;
          else if (m.safe) expected = ALLOW;
          else if (o.kind === 'allowed') expected = ALLOW;
          else if (o.kind === 'absent' && s.quiet) expected = ALLOW;
          else expected = ORIGIN;
          return { m: m.value, h: h.value, o: o.value, s: s.value, expected };
        }),
      ),
    ),
  );

  it('covers every combination of method, Host, Origin and Sec-Fetch-Site', () => {
    expect(cells).toHaveLength(9 * 5 * 7 * 6);
    // The table is not trivially one-sided.
    for (const decision of [ALLOW, HOST, ORIGIN]) {
      expect(cells.filter((cell) => cell.expected === decision).length).toBeGreaterThan(50);
    }
  });

  it.each(cells.map((cell) => [JSON.stringify(cell), cell] as const))('%s', (_name, cell) => {
    const decision = evaluateRequest(policy, {
      method: cell.m,
      host: cell.h,
      origin: cell.o,
      secFetchSite: cell.s,
    });
    expect(decision).toEqual(cell.expected);
  });
});

describe('evaluateRequest: IPv6 API host', () => {
  const v6 = buildGuardPolicy({ apiHost: '::1', apiPort: 3000, allowedOrigins: [] });

  it('accepts the bracketed literal and nothing that merely resembles it', () => {
    expect(evaluateRequest(v6, facts({ method: 'GET', host: '[::1]:3000' }))).toEqual(ALLOW);
    for (const host of ['::1:3000', '[::1]', '[0:0:0:0:0:0:0:1]:3000', '[::ffff:127.0.0.1]:3000']) {
      expect(evaluateRequest(v6, facts({ method: 'GET', host }))).toEqual(HOST);
    }
  });
});
