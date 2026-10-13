import { z } from 'zod';

/** Body of `GET /health`. The same shape is returned for 200 and 503. */
export const HealthResponse = z.object({
  status: z.enum(['ok', 'degraded']),
  database: z.enum(['up', 'down']),
  shopifyApiVersion: z.string(),
});

export type HealthResponse = z.infer<typeof HealthResponse>;
