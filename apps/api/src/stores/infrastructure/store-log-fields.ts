/**
 * The only field names a store log event may carry, besides `event` (design D23). The redactor
 * masks any key containing `authorization`, `cookie`, `token`, `secret`, `password`, `signature`
 * or `credential`, so these names avoid those words: `authKind` and `expiresAt`, never
 * `credentialKind` or `tokenExpiresAt`. Store summaries hold `hasCredentials` and are never logged.
 */
export const STORE_LOG_FIELDS = [
  'storeId',
  'shopDomain',
  'authKind',
  'expiresAt',
  'kind',
  'reason',
  'attempt',
  'delayMs',
  'status',
  'durationMs',
  'errorName',
] as const;

export type StoreLogField = (typeof STORE_LOG_FIELDS)[number];

/** Every event also carries its name under this key. */
export const STORE_LOG_EVENT_KEY = 'event';

/** True when `name` may appear as a key of a store log event. */
export const isDeclaredStoreLogField = (name: string): boolean =>
  name === STORE_LOG_EVENT_KEY || (STORE_LOG_FIELDS as readonly string[]).includes(name);
