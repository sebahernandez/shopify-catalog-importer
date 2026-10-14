import { HealthResponse } from '@importer/contracts';
import type { HealthState } from '../health-state';

// Same-origin: in development the Vite proxy forwards this path to the API, so no host or port is
// written anywhere in the web sources.
export const HEALTH_PATH = '/health';
export const HEALTH_TIMEOUT_MS = 5000;

export interface HealthResult {
  readonly state: Exclude<HealthState, 'loading'>;
  readonly shopifyApiVersion?: string;
}

export interface HealthClientOptions {
  readonly fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
  readonly timeoutMs?: number;
  /** Aborted by the caller when the page goes away. */
  readonly signal?: AbortSignal;
}

const UNREACHABLE: HealthResult = { state: 'unreachable' };

// The only server text the page may show. Anything that is not a short plain token is dropped
// (the state is still reported), so a hostile or broken answer cannot put content on screen.
const DISPLAYABLE_VERSION = /^[A-Za-z0-9._-]{1,32}$/;

/**
 * Fail closed: only the two documented pairs of status code and body are believed. Everything
 * else, including a body that disagrees with its status code, is unreachable.
 */
export function toHealthResult(status: number, body: unknown): HealthResult {
  const parsed = HealthResponse.safeParse(body);
  if (!parsed.success) return UNREACHABLE;
  const { status: reported, database, shopifyApiVersion } = parsed.data;
  const state =
    status === 200 && reported === 'ok' && database === 'up'
      ? 'ok'
      : status === 503 && reported === 'degraded' && database === 'down'
        ? 'degraded'
        : undefined;
  if (state === undefined) return UNREACHABLE;
  return DISPLAYABLE_VERSION.test(shopifyApiVersion) ? { state, shopifyApiVersion } : { state };
}

export async function fetchHealth(options: HealthClientOptions = {}): Promise<HealthResult> {
  const { fetchFn = fetch, timeoutMs = HEALTH_TIMEOUT_MS, signal } = options;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) return UNREACHABLE;
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);

  // An injected fetch may ignore its signal, so the whole exchange also races the abort.
  const aborted = new Promise<HealthResult>((resolve) => {
    controller.signal.addEventListener('abort', () => resolve(UNREACHABLE), { once: true });
  });
  const exchange = (async (): Promise<HealthResult> => {
    try {
      const response = await fetchFn(HEALTH_PATH, {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
      });
      return toHealthResult(response.status, await response.json());
    } catch {
      return UNREACHABLE;
    }
  })();

  try {
    return await Promise.race([exchange, aborted]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
