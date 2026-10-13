import { afterEach, describe, expect, it } from 'vitest';
import {
  REDACTED,
  clearRegisteredSecretsForTests,
  redact,
  redactString,
  registerSecret,
} from './redact.js';

// Every secret below is an obviously synthetic placeholder, never a real credential.
const FAKE_TOKEN = 'shpat_fake1234';

function serialized(value: unknown): string {
  return JSON.stringify(redact(value));
}

function elapsedMs(run: () => unknown): number {
  const start = performance.now();
  run();
  return performance.now() - start;
}

afterEach(() => {
  clearRegisteredSecretsForTests();
});

describe('redact: key names', () => {
  it.each([
    'accessToken',
    'access_token',
    'Authorization',
    'Set-Cookie',
    'password',
    'clientSecret',
    'signature',
    'X-Amz-Signature',
    'credentials',
    'apiKey',
    'api_key',
    'secretKey',
    'privateKey',
    'encryptionKey',
    'accessKey',
    'signing_key',
    'masterKey',
    'authKey',
    'API_KEY',
    'PASSWORD',
  ])('redacts the value under %s, whatever its type', (name) => {
    expect(redact({ [name]: FAKE_TOKEN })).toEqual({ [name]: REDACTED });
    expect(redact({ [name]: 12345 })).toEqual({ [name]: REDACTED });
    expect(serialized({ [name]: { inner: FAKE_TOKEN } })).not.toContain(FAKE_TOKEN);
  });

  it.each(['product_key', 'keyId', 'key', 'monkey', 'count', 'sku', 'title'])(
    'preserves the domain field %s',
    (name) => {
      expect(redact({ [name]: 'visible-3' })).toEqual({ [name]: 'visible-3' });
    },
  );

  it('keeps a numeric count so the line stays useful', () => {
    expect(redact({ count: 3 })).toEqual({ count: 3 });
  });

  it('redacts at any depth, including inside arrays', () => {
    const input = {
      request: { headers: [{ name: 'a', Authorization: FAKE_TOKEN }], product_key: 'p-1' },
      list: [[{ deep: { accessToken: FAKE_TOKEN } }]],
    };
    expect(redact(input)).toEqual({
      request: { headers: [{ name: 'a', Authorization: REDACTED }], product_key: 'p-1' },
      list: [[{ deep: { accessToken: REDACTED } }]],
    });
    expect(serialized(input)).not.toContain(FAKE_TOKEN);
  });
});

describe('redact: value patterns', () => {
  it('redacts a bearer credential and keeps the surrounding text', () => {
    expect(redactString('failed: Bearer abc.def-123 for user')).toBe(
      `failed: Bearer ${REDACTED} for user`,
    );
    expect(redactString('bearer   xyz')).toBe(`bearer   ${REDACTED}`);
  });

  it.each(['shpat_fake1234', 'shpca_fake1234', 'shppa_fake1234'])(
    'redacts the Shopify style token %s inside free text',
    (token) => {
      const text = redactString(`using ${token} now`);
      expect(text).not.toContain(token);
      expect(text).toContain('using ');
    },
  );

  it('leaves look-alike words alone', () => {
    expect(redactString('shopify shop_name shp')).toBe('shopify shop_name shp');
  });

  it('redacts URL userinfo and every query and fragment value, keeping scheme, host and path', () => {
    expect(redactString('https://user:pa55@example.test/p/a?token=abc&x=1#frag=zz')).toBe(
      `https://${REDACTED}@example.test/p/a?token=${REDACTED}&x=${REDACTED}#frag=${REDACTED}`,
    );
  });

  it('redacts a password that contains an at sign', () => {
    const text = redactString('http://user:p@ss@example.test/path');
    expect(text).toBe(`http://${REDACTED}@example.test/path`);
    expect(text).not.toContain('ss');
  });

  it('keeps a URL without secrets and the text around a URL', () => {
    expect(redactString('GET https://example.test/a/b done')).toBe(
      'GET https://example.test/a/b done',
    );
    expect(redactString('see https://h.test/a?b=c now')).toBe(
      `see https://h.test/a?b=${REDACTED} now`,
    );
  });

  it('applies the patterns to strings nested under harmless keys', () => {
    const out = serialized({ note: { line: `call https://h.test/x?sig=zzz with ${FAKE_TOKEN}` } });
    expect(out).not.toContain('zzz');
    expect(out).not.toContain(FAKE_TOKEN);
  });
});

describe('registerSecret', () => {
  it('redacts a registered value inside a longer string', () => {
    registerSecret('unit-test-key-0001');
    expect(redactString('prefix unit-test-key-0001 suffix, again unit-test-key-0001')).toBe(
      `prefix ${REDACTED} suffix, again ${REDACTED}`,
    );
  });

  it('accepts exactly eight characters and ignores shorter values', () => {
    expect(registerSecret('1234567')).toBe(false);
    expect(registerSecret('12345678')).toBe(true);
    expect(redactString('short 1234567 and 12345678')).toBe(`short 1234567 and ${REDACTED}`);
  });

  it('redacts overlapping secrets without leaving a fragment of the longer one', () => {
    registerSecret('abcdefgh');
    registerSecret('abcdefghij');
    expect(redactString('x abcdefghij y')).toBe(`x ${REDACTED} y`);
  });

  it('handles values that look like regular expressions literally', () => {
    registerSecret('a.b*c+(d)[e]');
    expect(redactString('p a.b*c+(d)[e] q axbbbc+(d)[e]')).toBe(`p ${REDACTED} q axbbbc+(d)[e]`);
  });

  it('redacts a registered value under a harmless key and in an Error', () => {
    registerSecret('unit-test-key-0001');
    const out = serialized({
      note: 'k=unit-test-key-0001',
      err: new Error('boom unit-test-key-0001'),
    });
    expect(out).not.toContain('unit-test-key-0001');
  });

  it('stops redacting after the registry is cleared', () => {
    registerSecret('unit-test-key-0001');
    clearRegisteredSecretsForTests();
    expect(redactString('unit-test-key-0001')).toBe('unit-test-key-0001');
  });
});

describe('redact: Error', () => {
  it('returns a plain object with redacted name, message and stack', () => {
    const error = new Error(`call failed with ${FAKE_TOKEN}`);
    error.stack = `Error: call failed with ${FAKE_TOKEN}\n    at somewhere`;
    const out = redact(error) as Record<string, unknown>;
    expect(out['name']).toBe('Error');
    expect(out['message']).toBe(`call failed with ${REDACTED}`);
    expect(out['stack']).toBe(`Error: call failed with ${REDACTED}\n    at somewhere`);
    expect(JSON.stringify(out)).not.toContain(FAKE_TOKEN);
  });

  it('keeps a subclass name', () => {
    class FakeFailure extends Error {
      override name = 'FakeFailure';
    }
    expect((redact(new FakeFailure('x')) as Record<string, unknown>)['name']).toBe('FakeFailure');
  });

  it('redacts the cause and own properties by key name', () => {
    const error = Object.assign(new Error('outer', { cause: new Error(`inner ${FAKE_TOKEN}`) }), {
      config: { headers: { authorization: FAKE_TOKEN }, url: 'https://h.test/a' },
    });
    const out = serialized(error);
    expect(out).not.toContain(FAKE_TOKEN);
    expect(out).toContain('"url":"https://h.test/a"');
    expect(out).toContain('inner');
  });
});

describe('redact: non-plain values', () => {
  it('turns a Date into an ISO string and an invalid Date into a fixed marker', () => {
    expect(redact(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)))).toBe('2026-01-02T03:04:05.000Z');
    expect(redact(new Date(Number.NaN))).toBe('Invalid Date');
  });

  it('redacts Map entries by key name and Set members by value pattern', () => {
    expect(
      redact(
        new Map<string, unknown>([
          ['accessToken', FAKE_TOKEN],
          ['count', 3],
        ]),
      ),
    ).toEqual([
      ['accessToken', REDACTED],
      ['count', 3],
    ]);
    expect(redact(new Set([`Bearer ${FAKE_TOKEN}`, 'ok']))).toEqual([`Bearer ${REDACTED}`, 'ok']);
  });

  it('never prints binary content', () => {
    expect(redact(Buffer.from(FAKE_TOKEN))).toBe('[Binary 14 bytes]');
    expect(redact(new Uint8Array(4))).toBe('[Binary 4 bytes]');
    expect(redact(new ArrayBuffer(2))).toBe('[Binary 2 bytes]');
  });

  it('treats a class instance as its own enumerable properties', () => {
    class Holder {
      accessToken = FAKE_TOKEN;
      count = 3;
    }
    expect(redact(new Holder())).toEqual({ accessToken: REDACTED, count: 3 });
  });

  it('honours toJSON and redacts what it returns', () => {
    const value = { toJSON: () => ({ accessToken: FAKE_TOKEN, shown: '12.5' }) };
    expect(redact(value)).toEqual({ accessToken: REDACTED, shown: '12.5' });
  });

  it('passes primitives through and neutralises functions and symbols', () => {
    expect(redact(7)).toBe(7);
    expect(redact(true)).toBe(true);
    expect(redact(null)).toBeNull();
    expect(redact(undefined)).toBeUndefined();
    expect(redact(10n)).toBe(10n);
    expect(redact(() => FAKE_TOKEN)).toBe('[Function]');
    expect(redact(Symbol(FAKE_TOKEN))).toBe(`Symbol(${REDACTED})`);
  });

  it('does not let a __proto__ key change the prototype of the result', () => {
    const out = redact(JSON.parse('{"__proto__": {"polluted": 1}, "ok": 1}')) as object;
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.keys(out)).toEqual(['__proto__', 'ok']);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('redact: robustness', () => {
  it('does not mutate its input', () => {
    const input = Object.freeze({
      accessToken: FAKE_TOKEN,
      nested: Object.freeze({ list: Object.freeze([FAKE_TOKEN]) }),
    });
    const before = JSON.stringify(input);
    redact(input);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('terminates on a cycle and marks it', () => {
    const node: Record<string, unknown> = { name: 'a' };
    node['self'] = node;
    node['list'] = [node];
    expect(redact(node)).toEqual({ name: 'a', self: '[Circular]', list: ['[Circular]'] });
  });

  it('does not call a shared, non-cyclic reference circular', () => {
    const shared = { count: 1 };
    expect(redact({ a: shared, b: shared })).toEqual({ a: { count: 1 }, b: { count: 1 } });
  });

  it('truncates a very deep structure without overflowing the stack', () => {
    let deep: Record<string, unknown> = { leaf: FAKE_TOKEN };
    for (let i = 0; i < 100_000; i += 1) deep = { child: deep };
    const out = serialized(deep);
    expect(out).toContain('[Truncated]');
    expect(out).not.toContain(FAKE_TOKEN);
  });

  it('bounds a structure that fans out through shared references', () => {
    let level: unknown = { value: FAKE_TOKEN };
    for (let i = 0; i < 30; i += 1) level = { left: level, right: level };
    let out = '';
    expect(elapsedMs(() => (out = serialized(level)))).toBeLessThan(1000);
    expect(out).toContain('[Truncated]');
  });

  it('bounds a huge sparse array', () => {
    const sparse: unknown[] = [];
    sparse.length = 4_000_000_000;
    expect(elapsedMs(() => redact(sparse))).toBeLessThan(1000);
  });

  it('replaces a node it cannot read instead of throwing', () => {
    const hostile = {
      get boom(): string {
        throw new Error(FAKE_TOKEN);
      },
      count: 3,
    };
    const out = redact(hostile) as Record<string, unknown>;
    expect(out['boom']).toBe('[Unredactable]');
    expect(out['count']).toBe(3);
  });

  it('survives a throwing toJSON and a revoked proxy', () => {
    const bad = {
      toJSON(): never {
        throw new Error('no');
      },
    };
    const revoked = Proxy.revocable({}, {});
    revoked.revoke();
    expect(redact({ bad, revoked: revoked.proxy })).toEqual({
      bad: '[Unredactable]',
      revoked: '[Unredactable]',
    });
  });
});

describe('redact: adversarial strings stay linear', () => {
  const SIZE = 200_000;
  it.each([
    ['whitespace after Bearer', `Bearer${' '.repeat(SIZE)}`],
    ['repeated Bearer', 'Bearer  '.repeat(SIZE / 8)],
    ['long scheme-like run', 'a'.repeat(SIZE)],
    ['scheme-like runs with colons', 'ab:/'.repeat(SIZE / 4)],
    ['query separators', `https://h.test/${'?a'.repeat(SIZE / 2)}`],
    ['ampersands', `https://h.test/?${'&'.repeat(SIZE)}`],
    ['at signs in the authority', `http://${'@'.repeat(SIZE)}`],
    ['near-miss tokens', 'shpa'.repeat(SIZE / 4)],
    ['near-miss registered secret', `${'abcdefg'.repeat(SIZE / 7)}`],
  ])('finishes quickly on %s', (_label, input) => {
    registerSecret('abcdefgh');
    expect(elapsedMs(() => redactString(input))).toBeLessThan(1000);
  });
});

describe('redact: seeded secret absent from output', () => {
  it('leaves the secret out of every position at once', () => {
    registerSecret('unit-test-key-0001');
    const input = {
      accessToken: FAKE_TOKEN,
      message: `Bearer ${FAKE_TOKEN} and unit-test-key-0001`,
      url: `https://u:${FAKE_TOKEN}@h.test/p?code=${FAKE_TOKEN}`,
      err: new Error(FAKE_TOKEN),
      list: [{ password: FAKE_TOKEN }],
      count: 3,
    };
    const out = serialized(input);
    expect(out).not.toContain(FAKE_TOKEN);
    expect(out).not.toContain('unit-test-key-0001');
    expect(out).toContain('"count":3');
  });
});
