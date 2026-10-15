import { z } from 'zod';
import { ShopifyErrorKind } from './shopify-errors.js';

const SPECIAL_CODES = {
  API_VERSION_MISMATCH: 'VERSION_UNSUPPORTED',
  CREDENTIALS_UNREADABLE: 'AUTH_FAILED',
} as const;

/** A problem `code` equals its `kind`, except for the two special codes. */
export const VerificationProblem = z
  .object({
    kind: ShopifyErrorKind,
    code: z.union([ShopifyErrorKind, z.enum(['API_VERSION_MISMATCH', 'CREDENTIALS_UNREADABLE'])]),
    params: z.record(z.string(), z.union([z.string(), z.number(), z.array(z.string())])),
  })
  .refine(
    (problem) =>
      problem.code in SPECIAL_CODES
        ? SPECIAL_CODES[problem.code as keyof typeof SPECIAL_CODES] === problem.kind
        : problem.code === problem.kind,
    { message: 'code must equal kind unless it is a special code', path: ['code'] },
  );

export type VerificationProblem = z.infer<typeof VerificationProblem>;

const Location = z.object({
  id: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  fulfillsOnlineOrders: z.boolean(),
});

const verificationFields = {
  ok: z.boolean(),
  checkedAt: z.iso.datetime(),
  shop: z
    .object({
      id: z.string(),
      name: z.string(),
      currencyCode: z.string(),
      planName: z.string(),
      shopifyPlus: z.boolean(),
      partnerDevelopment: z.boolean(),
    })
    .nullable(),
  apiVersion: z.object({ requested: z.string(), used: z.string().nullable() }),
  scopes: z.object({
    granted: z.array(z.string()),
    required: z.array(z.string()),
    missing: z.array(z.string()),
  }),
  locationsTruncated: z.boolean(),
  problems: z.array(VerificationProblem),
};

const okMatchesProblems = (value: { ok: boolean; problems: unknown[] }): boolean =>
  value.ok === (value.problems.length === 0);
const okRule = { message: 'ok must be true if and only if problems is empty', path: ['ok'] };

/** Result of a verification. `ok` is true if and only if there are no problems. */
export const StoreVerification = z
  .object({ ...verificationFields, locations: z.array(Location) })
  .refine(okMatchesProblems, okRule);

export type StoreVerification = z.infer<typeof StoreVerification>;

/** Stored form: the same fields with `locationCount` in place of `locations`. */
export const VerificationSnapshot = z
  .strictObject({ ...verificationFields, locationCount: z.number().int().nonnegative() })
  .refine(okMatchesProblems, okRule);

export type VerificationSnapshot = z.infer<typeof VerificationSnapshot>;
