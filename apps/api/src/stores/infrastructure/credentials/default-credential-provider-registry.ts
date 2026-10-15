import type { Store } from '../../domain/store.js';
import type { CredentialProvider } from '../../ports/credential-provider.port.js';
import type { CredentialProviderRegistry } from '../../ports/credential-provider-registry.port.js';
import type { CredentialVault } from '../../ports/credential-vault.port.js';
import {
  ClientCredentialsProvider,
  type ClientCredentialsProviderOptions,
} from './client-credentials-provider.js';
import { StaticTokenProvider } from './static-token-provider.js';

interface Entry {
  readonly envelope: string;
  readonly provider: CredentialProvider;
}

export interface DefaultCredentialProviderRegistryOptions {
  readonly vault: CredentialVault;
  readonly exchanger: ClientCredentialsProviderOptions['exchanger'];
  readonly now: () => number;
}

/**
 * Keeps one client-credentials provider per store, keyed by store id plus envelope, so the 24 h
 * token survives across requests and a replaced envelope starts with an empty cache.
 */
export class DefaultCredentialProviderRegistry implements CredentialProviderRegistry {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly options: DefaultCredentialProviderRegistryOptions) {}

  forStore(record: Store): CredentialProvider {
    const cached = this.entries.get(record.id);
    if (cached?.envelope === record.credentialsEnvelope) return cached.provider;
    const payload = this.options.vault.open(record.id, record.authKind, record.credentialsEnvelope);
    if (payload.kind === 'static_token') {
      this.entries.delete(record.id);
      return new StaticTokenProvider(payload.accessToken);
    }
    const provider = new ClientCredentialsProvider({
      domain: record.shopDomain,
      clientId: payload.clientId,
      clientSecret: payload.clientSecret,
      exchanger: this.options.exchanger,
      now: this.options.now,
    });
    this.entries.set(record.id, { envelope: record.credentialsEnvelope, provider });
    return provider;
  }

  forget(storeId: string): void {
    this.entries.delete(storeId);
  }
}
