import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import { parseShopDomain } from '../../domain/shop-domain.js';
import { StaticTokenProvider } from './static-token-provider.js';
import { ClientCredentialsProvider } from './client-credentials-provider.js';

const parsed = parseShopDomain('acme.myshopify.com');
if (!parsed.ok) throw new Error('fixture domain');
const DOMAIN = parsed.domain;
const T = 1_000_000;

function setup(script: Array<string | Error> = []) {
  const clock = { ms: T };
  const queue = [...script];
  let calls = 0;
  const exchange = vi.fn(async () => {
    calls += 1;
    await Promise.resolve();
    const next = queue.shift() ?? `token-${calls}`;
    if (next instanceof Error) throw next;
    return { accessToken: next, expiresAtMs: T + 86399 * 1000 };
  });
  const make = () =>
    new ClientCredentialsProvider({
      domain: DOMAIN,
      clientId: 'id',
      clientSecret: 'secret-value',
      exchanger: { exchange },
      now: () => clock.ms,
    });
  return { clock, exchange, provider: make(), make };
}

describe('ClientCredentialsProvider', () => {
  it('is the client_credentials kind', () => {
    expect(setup().provider.authKind).toBe('client_credentials');
  });

  it('reuses the token until 60 s before expiry and exchanges again at that instant', async () => {
    const { clock, exchange, provider } = setup();
    const first = await provider.accessToken();
    clock.ms = T + 86339 * 1000;
    await expect(provider.accessToken()).resolves.toBe(first);
    expect(exchange).toHaveBeenCalledTimes(1);
    clock.ms = T + 86340 * 1000;
    await expect(provider.accessToken()).resolves.toBe('token-2');
    expect(exchange).toHaveBeenCalledTimes(2);
  });

  it('keeps stores independent', async () => {
    const a = setup(['A']);
    const b = setup(['B']);
    await a.provider.accessToken();
    await b.provider.accessToken();
    a.clock.ms = T + 86340 * 1000;
    await expect(a.provider.accessToken()).resolves.toBe('token-2');
    await expect(b.provider.accessToken()).resolves.toBe('B');
    expect(b.exchange).toHaveBeenCalledTimes(1);
  });

  it('sends one exchange for five concurrent calls', async () => {
    const { exchange, provider } = setup();
    const tokens = await Promise.all(Array.from({ length: 5 }, () => provider.accessToken()));
    expect(new Set(tokens)).toEqual(new Set(['token-1']));
    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it('shares one failure and does not cache it', async () => {
    const { exchange, provider } = setup([new ShopifyGatewayError('SERVER_ERROR')]);
    const results = await Promise.allSettled([1, 2, 3].map(() => provider.accessToken()));
    expect(exchange).toHaveBeenCalledTimes(1);
    for (const r of results) {
      expect(r.status).toBe('rejected');
      expect((r as PromiseRejectedResult).reason).toMatchObject({ kind: 'SERVER_ERROR' });
    }
    await expect(provider.accessToken()).resolves.toBe('token-2');
    expect(exchange).toHaveBeenCalledTimes(2);
  });

  it('drops the cache on a rejection and exchanges once', async () => {
    const { exchange, provider } = setup();
    const rejected = await provider.accessToken();
    await expect(provider.refreshAfterRejection(rejected)).resolves.toBe('token-2');
    expect(exchange).toHaveBeenCalledTimes(2);
  });

  it('returns a different cached token without an exchange', async () => {
    const { exchange, provider } = setup();
    await provider.accessToken();
    await expect(provider.refreshAfterRejection('older-rejected')).resolves.toBe('token-1');
    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it('shares one exchange across concurrent forced refreshes of the same token', async () => {
    const { exchange, provider } = setup();
    const rejected = await provider.accessToken();
    const out = await Promise.all([1, 2, 3].map(() => provider.refreshAfterRejection(rejected)));
    expect(out).toEqual(['token-2', 'token-2', 'token-2']);
    expect(exchange).toHaveBeenCalledTimes(2);
  });

  it('lets a static provider answer null on refresh', async () => {
    await expect(
      new StaticTokenProvider('static-token-1').refreshAfterRejection(),
    ).resolves.toBeNull();
  });

  it('writes nothing to the file system', async () => {
    const spies = (['writeFileSync', 'appendFileSync', 'mkdirSync'] as const).map((name) =>
      vi.spyOn(fs, name).mockImplementation(() => undefined),
    );
    const { provider } = setup();
    await provider.accessToken();
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
