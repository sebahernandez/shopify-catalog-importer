import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';

export const MAX_ATTEMPTS = 3;

export interface RetryOptions {
  /** Absent means `'none'`: only declared-safe reads are ever retried. */
  readonly retry: 'safe' | 'none' | undefined;
  readonly sleep: (ms: number) => Promise<void>;
  readonly random: () => number;
}

/** Design D15: at most 3 attempts, retryable kinds only, wait `random() * 1000 * 2^(n-1)`. */
export const withRetry = async <T>(
  attempt: () => Promise<T>,
  options: RetryOptions,
): Promise<T> => {
  for (let n = 1; ; n++) {
    try {
      return await attempt();
    } catch (error) {
      const retryable =
        options.retry === 'safe' &&
        n < MAX_ATTEMPTS &&
        error instanceof ShopifyGatewayError &&
        error.retryable;
      if (!retryable) throw error;
      const backoff = options.random() * 1000 * 2 ** (n - 1);
      await options.sleep(Math.max(backoff, error.retryAfterMs ?? 0));
    }
  }
};
