import type { AuthKind } from '@importer/contracts';

/** What the credentials form holds: raw field text, validated by the API, not by the page. */
export interface CredentialsFormValues {
  readonly displayName: string;
  readonly domain: string;
  readonly kind: AuthKind;
  readonly accessToken: string;
  readonly clientId: string;
  readonly clientSecret: string;
}

export const EMPTY_CREDENTIALS_FORM: CredentialsFormValues = {
  displayName: '',
  domain: '',
  kind: 'static_token',
  accessToken: '',
  clientId: '',
  clientSecret: '',
};
