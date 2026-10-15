import type { AuthKind } from '@importer/contracts';
import type { CredentialProvider } from '../../ports/credential-provider.port.js';

/** A token the operator pasted: it needs no exchange and cannot be renewed. */
export class StaticTokenProvider implements CredentialProvider {
  readonly authKind: AuthKind = 'static_token';

  constructor(private readonly token: string) {}

  accessToken(): Promise<string> {
    return Promise.resolve(this.token);
  }

  refreshAfterRejection(): Promise<string | null> {
    return Promise.resolve(null);
  }
}
