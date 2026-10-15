import { ThrottleStatus } from './throttle-status.js';

interface Observation {
  readonly status: ThrottleStatus;
  readonly atMs: number;
}

/** Pure, in-memory bucket model per canonical shop domain (design D15). */
export const createThrottleTracker = (options: { readonly nowMs: () => number }) => {
  const observed = new Map<string, Observation>();
  return {
    /** Records the last cost block; anything malformed leaves the state unchanged. */
    observe(domain: string, raw: unknown): void {
      const status = ThrottleStatus.safeParse(raw);
      if (status.success) observed.set(domain, { status: status.data, atMs: options.nowMs() });
    },
    /** Milliseconds to wait, rounded up, before a query of `estimatedCost` fits the bucket. */
    waitTimeFor(domain: string, estimatedCost: number): number {
      const last = observed.get(domain);
      if (last === undefined) return 0;
      const { maximumAvailable, currentlyAvailable, restoreRate } = last.status;
      const restored = (restoreRate * (options.nowMs() - last.atMs)) / 1000;
      const available = Math.min(maximumAvailable, currentlyAvailable + restored);
      const missing = Math.min(estimatedCost, maximumAvailable) - available;
      return missing > 0 && restoreRate > 0 ? Math.ceil((missing / restoreRate) * 1000) : 0;
    },
  };
};
