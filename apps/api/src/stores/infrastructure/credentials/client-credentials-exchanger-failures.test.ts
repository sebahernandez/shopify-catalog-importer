import { describe, expect, it } from 'vitest';
import { parseShopDomain, type ShopDomain } from '../../domain/shop-domain.js';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import { scriptedFetch, type ScriptStep } from '../../test-support/scripted-fetch.js';
import { createShopifyHttpTransport } from '../gateway/shopify-http-transport.js';
import { createClientCredentialsExchanger } from './client-credentials-exchanger.js';

const parsed = parseShopDomain('mystore.myshopify.com');
if (!parsed.ok) throw new Error('fixture domain must parse');
const domain: ShopDomain = parsed.domain;
const JSON_HEADERS = { 'content-type': 'application/json' };
const CLIENT_ID = 'client-id-visible-canary';
const CANARY = 'client_secret=CANARY-body-text';

const fail = async (step: ScriptStep): Promise<ShopifyGatewayError> => {
  const { fetch } = scriptedFetch([step]);
  const exchanger = createClientCredentialsExchanger({
    transport: createShopifyHttpTransport({ fetchFn: fetch }),
    now: () => 0,
  });
  const error = await exchanger
    .exchange({ domain, clientId: CLIENT_ID, clientSecret: 'secret-value-123' })
    .catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ShopifyGatewayError);
  return error as ShopifyGatewayError;
};
const status = (code: number, body: unknown = { error: 'x' }): ScriptStep => ({
  status: code,
  headers: JSON_HEADERS,
  body: JSON.stringify(body),
});

describe('ClientCredentialsExchanger failures', () => {
  it('reports SHOP_NOT_PERMITTED when the body text names it', async () => {
    const error = await fail(
      status(400, {
        error:
          'Oauth error shop_not_permitted: Client credentials cannot be performed on this shop.',
      }),
    );
    expect(error.kind).toBe('CREDENTIAL_EXCHANGE_FAILED');
    expect(error.reason).toBe('SHOP_NOT_PERMITTED');
  });

  it('reports UNKNOWN for a 401 with an unrecognised body', async () => {
    const error = await fail(status(401, { error: 'invalid_client' }));
    expect(error.kind).toBe('CREDENTIAL_EXCHANGE_FAILED');
    expect(error.reason).toBe('UNKNOWN');
  });

  it('classifies transport and status failures', async () => {
    expect((await fail({ throws: new TypeError('fetch failed') })).kind).toBe('NETWORK');
    expect((await fail({ throws: new DOMException('t', 'TimeoutError') })).kind).toBe('TIMEOUT');
    expect((await fail(status(503))).kind).toBe('SERVER_ERROR');
    expect((await fail(status(429))).kind).toBe('THROTTLED');
  });

  it('fails an unparseable or non-JSON 2xx as an exchange failure', async () => {
    const bad = await fail({ status: 200, headers: JSON_HEADERS, body: '{not json' });
    expect(bad.kind).toBe('CREDENTIAL_EXCHANGE_FAILED');
    expect(bad.reason).toBe('UNKNOWN');
    const html = await fail({ status: 200, headers: { 'content-type': 'text/html' }, body: 'x' });
    expect(html.kind).toBe('CREDENTIAL_EXCHANGE_FAILED');
  });

  it('leaves no body text, canary or client id in message, properties or cause', async () => {
    const error = await fail(status(400, { error: CANARY, hint: 'shop_not_permitted' }));
    const seen = [error.message, ...Object.values(error).map(String), JSON.stringify(error)];
    for (const text of seen) {
      expect(text).not.toContain('CANARY');
      expect(text).not.toContain('client_secret');
      expect(text).not.toContain(CLIENT_ID);
      expect(text).not.toContain('shop_not_permitted');
    }
    expect(error.cause).toBeUndefined();
    expect(error.message).toBe('The credential exchange with Shopify failed.');
  });
});
