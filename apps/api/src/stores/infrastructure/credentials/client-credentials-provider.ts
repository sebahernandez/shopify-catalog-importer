import type { AuthKind } from '@importer/contracts';
import type { ShopDomain } from '../../domain/shop-domain.js';
import type { CredentialProvider } from '../../ports/credential-provider.port.js';
import type { ExchangedToken } from './client-credentials-exchanger.js';

/** A cached token is reused through this long before it expires (inclusive, so 86399 s reuses at 86339 s and renews at 86340 s). */
const REFRESH_MARGIN_MS = 60_000;

export interface ClientCredentialsProviderOptions {
  readonly domain: ShopDomain;
  readonly clientId: string;
  readonly clientSecret: string;
  readonly exchanger: {
    exchange(input: {
      readonly domain: ShopDomain;
      readonly clientId: string;
      readonly clientSecret: string;
    }): Promise<ExchangedToken>;
  };
  readonly now: () => number;
}

/**
 * Exchanges the client credentials of one store for a token and keeps it in memory only.
 * Concurrent callers share one exchange, success or failure; a failure is never cached.
 */
export class ClientCredentialsProvider implements CredentialProvider {
  readonly authKind: AuthKind = 'client_credentials';
  private cached: ExchangedToken | undefined;
  private inFlight: Promise<string> | undefined;

  constructor(private readonly options: ClientCredentialsProviderOptions) {}

  accessToken(): Promise<string> {
    return Promise.resolve(this.fresh() ?? this.inFlight ?? this.startExchange());
  }

  refreshAfterRejection(rejected: string): Promise<string | null> {
    const current = this.fresh();
    if (current !== undefined && current !== rejected) return Promise.resolve(current);
    if (this.inFlight !== undefined) return this.inFlight;
    this.cached = undefined;
    return this.startExchange();
  }

  private fresh(): string | undefined {
    const token = this.cached;
    const valid =
      token !== undefined && this.options.now() <= token.expiresAtMs - REFRESH_MARGIN_MS;
    return valid ? token.accessToken : undefined;
  }

  private startExchange(): Promise<string> {
    const { domain, clientId, clientSecret, exchanger } = this.options;
    const flight = exchanger
      .exchange({ domain, clientId, clientSecret })
      .then((token) => {
        this.cached = token;
        return token.accessToken;
      })
      .finally(() => {
        this.inFlight = undefined;
      });
    this.inFlight = flight;
    return flight;
  }
}
