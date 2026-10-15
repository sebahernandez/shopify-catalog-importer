import type { AuthKind } from '@importer/contracts';

/** Supplies Admin API access tokens for one store. */
export interface CredentialProvider {
  readonly authKind: AuthKind;
  accessToken(): Promise<string>;
  /** A fresh token after `rejected` was refused, or `null` when it cannot be renewed. */
  refreshAfterRejection(rejected: string): Promise<string | null>;
}
