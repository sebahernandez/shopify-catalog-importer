/** Decrypted credential payloads, discriminated by `kind` (they match the contract shapes). */
export interface StaticTokenPayload {
  readonly kind: 'static_token';
  readonly accessToken: string;
}

export interface ClientCredentialsPayload {
  readonly kind: 'client_credentials';
  readonly clientId: string;
  readonly clientSecret: string;
}

export type CredentialsPayload = StaticTokenPayload | ClientCredentialsPayload;
