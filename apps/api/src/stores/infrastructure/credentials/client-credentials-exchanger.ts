import { z } from 'zod';
import { registerSecret } from '../../../shared-kernel/logging/redact.js';
import type { ShopDomain } from '../../domain/shop-domain.js';
import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';
import type { createShopifyHttpTransport } from '../gateway/shopify-http-transport.js';
import { shopifyUrls } from '../gateway/shopify-urls.js';

export interface ExchangedToken {
  readonly accessToken: string;
  readonly expiresAtMs: number;
}

export interface ClientCredentialsExchangerOptions {
  readonly transport: Pick<ReturnType<typeof createShopifyHttpTransport>, 'postForm'>;
  readonly now: () => number;
}

const TokenResponse = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
});

/** Fixed-message failure; the body is only tested for the marker and then dropped. */
const exchangeFailure = (body: unknown): ShopifyGatewayError =>
  new ShopifyGatewayError('CREDENTIAL_EXCHANGE_FAILED', {
    reason: JSON.stringify(body)?.includes('shop_not_permitted') ? 'SHOP_NOT_PERMITTED' : 'UNKNOWN',
  });

export const createClientCredentialsExchanger = (options: ClientCredentialsExchangerOptions) => ({
  async exchange(input: {
    readonly domain: ShopDomain;
    readonly clientId: string;
    readonly clientSecret: string;
  }): Promise<ExchangedToken> {
    const response = await options.transport.postForm(shopifyUrls.token(input.domain), {
      grant_type: 'client_credentials',
      client_id: input.clientId,
      client_secret: input.clientSecret,
    });
    const body = response.body.kind === 'json' ? response.body.value : undefined;
    if (response.status >= 500) throw new ShopifyGatewayError('SERVER_ERROR');
    if (response.status === 429) throw new ShopifyGatewayError('THROTTLED');
    const parsed = TokenResponse.safeParse(body);
    if (response.status < 200 || response.status >= 300 || !parsed.success) {
      throw exchangeFailure(body);
    }
    registerSecret(parsed.data.access_token);
    return {
      accessToken: parsed.data.access_token,
      expiresAtMs: options.now() + parsed.data.expires_in * 1000,
    };
  },
});
