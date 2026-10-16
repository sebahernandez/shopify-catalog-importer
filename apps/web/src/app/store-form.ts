import type { CreateStoreBody, CredentialsPayload } from '@importer/contracts';
import type { CredentialsFormValues } from '../store-form-values';

/**
 * Builds the credentials the API expects from the raw fields. Only the fields of the chosen kind
 * are sent, so a token typed before switching to client credentials never travels. Validation
 * (length, shape) stays with the API: this only picks the right fields.
 */
export function toCredentials(values: CredentialsFormValues): CredentialsPayload {
  return values.kind === 'static_token'
    ? { kind: 'static_token', accessToken: values.accessToken }
    : { kind: 'client_credentials', clientId: values.clientId, clientSecret: values.clientSecret };
}

export function toCreateStoreBody(values: CredentialsFormValues): CreateStoreBody {
  return {
    displayName: values.displayName,
    domain: values.domain.trim().toLowerCase(),
    credentials: toCredentials(values),
  };
}
