import { z } from 'zod';

export const ThrottleStatus = z.object({
  maximumAvailable: z.number(),
  currentlyAvailable: z.number(),
  restoreRate: z.number(),
});
export type ThrottleStatus = z.infer<typeof ThrottleStatus>;
