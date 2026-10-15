import { z } from 'zod';
import { VerificationSnapshot } from './store-verification.js';

export const AUTH_KINDS = z.enum(['static_token', 'client_credentials']);

export type AuthKind = z.infer<typeof AUTH_KINDS>;

const text = z.string().trim().min(1).max(512);
/** Secrets need 8 characters so that log redaction can cover them. */
const secret = text.min(8);

export const StaticTokenCredentials = z.strictObject({
  kind: z.literal('static_token'),
  accessToken: secret,
});

export const ClientCredentials = z.strictObject({
  kind: z.literal('client_credentials'),
  clientId: text,
  clientSecret: secret,
});

export const CredentialsPayload = z.discriminatedUnion('kind', [
  StaticTokenCredentials,
  ClientCredentials,
]);

export type CredentialsPayload = z.infer<typeof CredentialsPayload>;

export const STORE_STATUSES = z.enum([
  'UNVERIFIED',
  'CONNECTED',
  'AUTH_FAILED',
  'SCOPE_MISSING',
  'UNAVAILABLE',
]);

export type StoreStatus = z.infer<typeof STORE_STATUSES>;

/** 1 to 80 Unicode code points after trimming (`max` would count UTF-16 units). */
const displayName = z
  .string()
  .trim()
  .min(1)
  .refine((value) => [...value].length <= 80, {
    message: 'displayName must be at most 80 characters',
  });

export const CreateStoreBody = z.strictObject({
  displayName,
  domain: z.string(),
  credentials: CredentialsPayload,
});

export type CreateStoreBody = z.infer<typeof CreateStoreBody>;

export const ReplaceCredentialsBody = z.strictObject({ credentials: CredentialsPayload });

export type ReplaceCredentialsBody = z.infer<typeof ReplaceCredentialsBody>;

/** A store as the API returns it. Credentials appear only as the boolean `hasCredentials`. */
export const StoreSummary = z.strictObject({
  id: z.uuid(),
  displayName: z.string(),
  shopDomain: z.string(),
  shopifyShopId: z.string().nullable(),
  apiVersion: z.string().nullable(),
  authKind: AUTH_KINDS,
  status: STORE_STATUSES,
  hasCredentials: z.boolean(),
  lastVerifiedAt: z.iso.datetime().nullable(),
  lastVerification: VerificationSnapshot.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type StoreSummary = z.infer<typeof StoreSummary>;
