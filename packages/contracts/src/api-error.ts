import { z } from 'zod';

/** Error body returned when the local request guard rejects a request. */
export const ApiError = z.object({
  error: z.object({
    code: z.enum(['HOST_NOT_ALLOWED', 'ORIGIN_NOT_ALLOWED']),
    message: z.string(),
  }),
});

export type ApiError = z.infer<typeof ApiError>;
