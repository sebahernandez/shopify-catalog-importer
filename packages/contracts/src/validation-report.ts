import { z } from 'zod';
import { ISSUE_CODES } from './issue-catalog.js';
import { DATA_SHEETS } from './workbook-schema.js';

/** One finding. `message` and `suggestedAction` are rendered from `code` and `params`. */
export const ValidationIssue = z.object({
  severity: z.enum(['error', 'warning']),
  code: ISSUE_CODES,
  params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  sheet: z.enum(DATA_SHEETS).nullable(),
  row: z.number().int().positive().nullable(),
  field: z.string().min(1).nullable(),
  productKey: z.string().nullable(),
  message: z.string().min(1),
  suggestedAction: z.string().min(1),
});

export type ValidationIssue = z.infer<typeof ValidationIssue>;

/** Report for every readable upload. `valid` covers tier A checks only. */
export const ValidationReport = z
  .object({
    valid: z.boolean(),
    fileSha256: z.string().regex(/^[0-9a-f]{64}$/),
    summary: z.object({
      errorCount: z.number().int().nonnegative(),
      warningCount: z.number().int().nonnegative(),
    }),
    truncated: z.boolean(),
    issues: z.array(ValidationIssue),
  })
  .refine((report) => report.valid === (report.summary.errorCount === 0), {
    message: 'valid must be true if and only if errorCount is 0',
    path: ['valid'],
  });

export type ValidationReport = z.infer<typeof ValidationReport>;
