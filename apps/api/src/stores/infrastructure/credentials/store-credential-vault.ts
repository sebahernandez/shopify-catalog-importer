import { CredentialsPayload as CredentialsSchema, type AuthKind } from '@importer/contracts';
import { registerSecret } from '../../../shared-kernel/logging/redact.js';
import type { SecretBox } from '../../../shared-kernel/secret-box/secret-box.port.js';
import type { CredentialsPayload } from '../../domain/credentials-payload.js';
import type { CredentialVault } from '../../ports/credential-vault.port.js';
import { CredentialsUnreadableError } from '../../ports/credentials-unreadable.error.js';

/** The context binds an envelope to its store, so it cannot be moved to another row. */
const contextOf = (storeId: string): string => `store:${storeId.toLowerCase()}:credentials`;

/** Defence after "never log it" (design D6): the secrets, never the client id, reach the redactor. */
function registerSecrets(payload: CredentialsPayload): void {
  registerSecret(payload.kind === 'static_token' ? payload.accessToken : payload.clientSecret);
}

/**
 * Stores one envelope per store. The kind lives in the `auth_kind` column, so the encrypted
 * payload is `{ accessToken }` or `{ clientId, clientSecret }` and `open` checks it against the
 * kind the caller read from the row.
 */
export class StoreCredentialVault implements CredentialVault {
  constructor(private readonly box: SecretBox) {}

  seal(storeId: string, payload: CredentialsPayload): string {
    const fields =
      payload.kind === 'static_token'
        ? { accessToken: payload.accessToken }
        : { clientId: payload.clientId, clientSecret: payload.clientSecret };
    const envelope = this.box.encrypt(JSON.stringify(fields), contextOf(storeId));
    registerSecrets(payload);
    return envelope;
  }

  open(storeId: string, authKind: AuthKind, envelope: string): CredentialsPayload {
    let payload: CredentialsPayload;
    try {
      const fields = JSON.parse(this.box.decrypt(envelope, contextOf(storeId))) as object;
      payload = CredentialsSchema.parse({ ...fields, kind: authKind });
    } catch {
      throw new CredentialsUnreadableError();
    }
    registerSecrets(payload);
    return payload;
  }
}
