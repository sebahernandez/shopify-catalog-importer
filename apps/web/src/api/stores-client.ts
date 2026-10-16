import {
  StoreSummary,
  StoreVerification,
  type CreateStoreBody,
  type CredentialsPayload,
} from '@importer/contracts';
import { jsonBody, request, type ApiResult, type ClientOptions, type Parser } from './request';

export const STORES_PATH = '/api/stores';

const storePath = (id: string): string => `${STORES_PATH}/${encodeURIComponent(id)}`;

// The list answer is `{ stores: [...] }`; every entry must be a valid summary or the list is
// rejected, so a partly broken answer is never shown as if it were whole.
const StoreList: Parser<StoreSummary[]> = {
  safeParse(value) {
    const stores = (value as { stores?: unknown } | null)?.stores;
    if (!Array.isArray(stores)) return { success: false };
    const parsed = stores.map((entry) => StoreSummary.safeParse(entry));
    return parsed.every((result) => result.success)
      ? { success: true, data: parsed.flatMap((result) => (result.success ? [result.data] : [])) }
      : { success: false };
  },
};

export function listStores(options: ClientOptions = {}): Promise<ApiResult<StoreSummary[]>> {
  return request(options, {
    method: 'GET',
    path: STORES_PATH,
    reply: { as: 'json', parser: StoreList },
  });
}

export function createStore(
  body: CreateStoreBody,
  options: ClientOptions = {},
): Promise<ApiResult<StoreSummary>> {
  return request(options, {
    method: 'POST',
    path: STORES_PATH,
    ...jsonBody(body),
    reply: { as: 'json', parser: StoreSummary },
  });
}

// Verification can take a few Shopify round trips, so it gets a longer limit than the default.
const VERIFY_TIMEOUT_MS = 90_000;

export function verifyStore(
  id: string,
  options: ClientOptions = {},
): Promise<ApiResult<StoreVerification>> {
  return request(
    { timeoutMs: VERIFY_TIMEOUT_MS, ...options },
    {
      method: 'POST',
      path: `${storePath(id)}/verify`,
      reply: { as: 'json', parser: StoreVerification },
    },
  );
}

export function replaceCredentials(
  id: string,
  credentials: CredentialsPayload,
  options: ClientOptions = {},
): Promise<ApiResult<StoreSummary>> {
  return request(options, {
    method: 'PUT',
    path: `${storePath(id)}/credentials`,
    ...jsonBody({ credentials }),
    reply: { as: 'json', parser: StoreSummary },
  });
}
