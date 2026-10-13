import { z } from 'zod';

/**
 * Canonical decimal string: no leading zeros, no trailing fraction zeros, no `+`, `.` as the
 * only separator, and zero is always `0` (never `-0`). The API `Money` value object produces
 * exactly this form. This is the design D5 grammar with negative zero excluded, as D5's prose
 * requires.
 */
const CANONICAL_MONEY = /^(0|-?[1-9][0-9]*|-?(0|[1-9][0-9]*)\.[0-9]*[1-9])$/;

/** An amount transported as a canonical decimal string, never as a JSON number. */
export const MoneyString = z.string().regex(CANONICAL_MONEY);

export type MoneyString = z.infer<typeof MoneyString>;
