import type { CreateStoreBody, ReplaceCredentialsBody } from '@importer/contracts';
import { StoreRequestInvalidError } from '../../application/store-errors.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => own.includes(key));
};

/**
 * Checks only the outer shape (exact members, string name and domain, object credentials) and
 * throws one fixed error otherwise. The display name length, the domain and the credential
 * fields are judged by the use case, in that order, so the precedence of the spec holds. No
 * schema issue is ever surfaced.
 */
export function parseCreateStoreRequest(body: unknown): CreateStoreBody {
  if (
    !isRecord(body) ||
    !hasExactKeys(body, ['displayName', 'domain', 'credentials']) ||
    typeof body['displayName'] !== 'string' ||
    typeof body['domain'] !== 'string' ||
    !isRecord(body['credentials'])
  ) {
    throw new StoreRequestInvalidError();
  }
  return body as unknown as CreateStoreBody;
}

export function parseReplaceCredentialsRequest(body: unknown): ReplaceCredentialsBody {
  if (!isRecord(body) || !hasExactKeys(body, ['credentials']) || !isRecord(body['credentials'])) {
    throw new StoreRequestInvalidError();
  }
  return body as unknown as ReplaceCredentialsBody;
}
