import { afterEach, describe, expect, it } from 'vitest';
import {
  clearRegisteredSecretsForTests,
  redactString,
} from '../../../shared-kernel/logging/redact.js';
import { parseShopDomain, type ShopDomain } from '../../domain/shop-domain.js';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import { scriptedFetch, type ScriptStep } from '../../test-support/scripted-fetch.js';
import { createShopifyHttpTransport } from '../gateway/shopify-http-transport.js';
import { createClientCredentialsExchanger } from './client-credentials-exchanger.js';

const parsed = parseShopDomain('mystore.myshopify.com');
if (!parsed.ok) throw new Error('fixture domain must parse');
const domain: ShopDomain = parsed.domain;
const JSON_HEADERS = { 'content-type': 'application/json' };
const NOW = 1_700_000_000_000;
const TOKEN = 'exchanged-opaque-token-value-123';

const setup = (steps: readonly ScriptStep[]) => {
  const { fetch, calls } = scriptedFetch(steps);
  const exchanger = createClientCredentialsExchanger({
    transport: createShopifyHttpTransport({ fetchFn: fetch }),
    now: () => NOW,
  });
  const run = () =>
    exchanger.exchange({ domain, clientId: 'the-client-id', clientSecret: 'the-client-secret' });
  return { run, calls };
};
const ok = (body: unknown): ScriptStep => ({
  status: 200,
  headers: JSON_HEADERS,
  body: JSON.stringify(body),
});

afterEach(() => clearRegisteredSecretsForTests());

describe('ClientCredentialsExchanger', () => {
  it('sends one form post without an access-token header and returns token and expiry', async () => {
    const { run, calls } = setup([
      ok({ access_token: TOKEN, scope: 'read_products', expires_in: 86399, extra: 'ignored' }),
    ]);
    const result = await run();
    expect(result).toEqual({ accessToken: TOKEN, expiresAtMs: NOW + 86_399_000 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://mystore.myshopify.com/admin/oauth/access_token');
    expect(calls[0]?.headers['content-type']).toBe('application/x-www-form-urlencoded');
    expect(calls[0]?.headers['x-shopify-access-token']).toBeUndefined();
    expect(calls[0]?.init.redirect).toBe('error');
    expect(calls[0]?.body).toBe(
      'grant_type=client_credentials&client_id=the-client-id&client_secret=the-client-secret',
    );
  });

  it('registers the received token for redaction', async () => {
    const { run } = setup([ok({ access_token: TOKEN, expires_in: 60 })]);
    expect(redactString(TOKEN)).toBe(TOKEN);
    await run();
    expect(redactString(`t=${TOKEN}`)).not.toContain(TOKEN);
  });

  it.each([
    ['no access_token', { expires_in: 10 }],
    ['empty access_token', { access_token: '', expires_in: 10 }],
    ['zero expires_in', { access_token: TOKEN, expires_in: 0 }],
    ['negative expires_in', { access_token: TOKEN, expires_in: -5 }],
    ['fractional expires_in', { access_token: TOKEN, expires_in: 1.5 }],
    ['missing expires_in', { access_token: TOKEN }],
  ])('fails the exchange for %s', async (_name, body) => {
    const { run } = setup([ok(body)]);
    const error = await run().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ShopifyGatewayError);
    expect((error as ShopifyGatewayError).kind).toBe('CREDENTIAL_EXCHANGE_FAILED');
  });
});
