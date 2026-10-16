import { ApiError, ImportRejected, type ValidationReport } from '@importer/contracts';

export type ApiErrorCode = ApiError['error']['code'];

/** Why a call did not produce the answer it was made for. Closed set: the screen maps each to copy. */
export type ApiFailure =
  | {
      readonly kind: 'api';
      readonly status: number;
      /** Null when the body was not a known ApiError (an HTML page from a proxy, a framework 500). */
      readonly code: ApiErrorCode | null;
      /** Present only for the 422 WORKBOOK_INVALID answer. */
      readonly report: ValidationReport | null;
    }
  | { readonly kind: 'network' }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'aborted' }
  | { readonly kind: 'invalid_response'; readonly status: number };

export type ApiResult<T> =
  { readonly ok: true; readonly data: T } | { readonly ok: false; readonly failure: ApiFailure };

export interface ClientOptions {
  readonly fetchFn?: (url: string, init: RequestInit) => Promise<Response>;
  /** Aborted by the caller (page goes away, or the user cancels). */
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
}

/** Anything with the safeParse shape of a zod schema, so this package needs no zod of its own. */
export interface Parser<T> {
  safeParse(value: unknown): { success: true; data: T } | { success: false };
}

export const DEFAULT_TIMEOUT_MS = 30_000;

export interface RequestSpec<T> {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly headers?: Record<string, string>;
  readonly body?: BodyInit;
  /** How a successful answer is read. */
  readonly reply:
    | { readonly as: 'json'; readonly parser: Parser<T> }
    | { readonly as: 'blob' }
    | { readonly as: 'empty' };
}

function fail(failure: ApiFailure): { ok: false; failure: ApiFailure } {
  return { ok: false, failure };
}

async function readError(response: Response): Promise<ApiFailure> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { kind: 'api', status: response.status, code: null, report: null };
  }
  const parsed = ApiError.safeParse(body);
  if (!parsed.success) return { kind: 'api', status: response.status, code: null, report: null };
  const { code } = parsed.data.error;
  const rejected = code === 'WORKBOOK_INVALID' ? ImportRejected.safeParse(body) : null;
  return {
    kind: 'api',
    status: response.status,
    code,
    report: rejected?.success ? rejected.data.report : null,
  };
}

/**
 * One same-origin call, fail closed: a success is believed only when its body matches the
 * contract; every other outcome (error answer, network error, timeout, caller abort) becomes a
 * typed failure. Never throws. An injected fetch may ignore its signal, so the whole exchange
 * also races the abort.
 */
export async function request<T>(
  options: ClientOptions,
  spec: RequestSpec<T>,
): Promise<ApiResult<T>> {
  const { fetchFn = fetch, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  if (signal?.aborted) return fail({ kind: 'aborted' });

  const controller = new AbortController();
  let reason: 'timeout' | 'aborted' = 'aborted';
  const onCallerAbort = () => {
    reason = 'aborted';
    controller.abort();
  };
  signal?.addEventListener('abort', onCallerAbort, { once: true });
  const timer = setTimeout(() => {
    reason = 'timeout';
    controller.abort();
  }, timeoutMs);

  const interrupted = new Promise<ApiResult<T>>((resolve) => {
    controller.signal.addEventListener('abort', () => resolve(fail({ kind: reason })), {
      once: true,
    });
  });

  const exchange = (async (): Promise<ApiResult<T>> => {
    try {
      const init: RequestInit = {
        method: spec.method,
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: controller.signal,
        ...(spec.headers ? { headers: spec.headers } : {}),
        ...(spec.body !== undefined ? { body: spec.body } : {}),
      };
      const response = await fetchFn(spec.path, init);
      if (response.status < 200 || response.status > 299) return fail(await readError(response));
      if (spec.reply.as === 'empty') return { ok: true, data: undefined as T };
      if (spec.reply.as === 'blob') return { ok: true, data: (await response.blob()) as T };
      const parsed = spec.reply.parser.safeParse(await response.json());
      return parsed.success
        ? { ok: true, data: parsed.data }
        : fail({ kind: 'invalid_response', status: response.status });
    } catch {
      return fail({ kind: 'network' });
    }
  })();

  try {
    return await Promise.race([exchange, interrupted]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

export function jsonBody(value: unknown): { headers: Record<string, string>; body: string } {
  return { headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) };
}
