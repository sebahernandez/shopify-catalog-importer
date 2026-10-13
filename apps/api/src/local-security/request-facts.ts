import type { HeaderValue, RequestFacts } from './request-policy.js';

/** The parts of a Node request the guard reads. Both are checked at run time, not trusted. */
export interface RawRequest {
  readonly method: unknown;
  readonly rawHeaders: unknown;
}

const UNREADABLE = 'Local request guard: the request headers are unreadable.';

/** All values of one header, in the order sent: absent, one string, or a list when repeated. */
function valuesOf(rawHeaders: readonly string[], name: string): HeaderValue {
  const values: string[] = [];
  for (let index = 0; index < rawHeaders.length; index += 2) {
    if (rawHeaders[index]?.toLowerCase() === name) values.push(rawHeaders[index + 1] ?? '');
  }
  if (values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
}

/**
 * Reads the facts the decision needs from the raw header list (names and values in the order
 * received), not from Node's merged `headers` object. The merged object joins a repeated `Origin`
 * with a comma and silently keeps only the first of a repeated `Host`, which would hide a repeat;
 * the raw list shows every copy, so a repeat becomes a list and is rejected by the rules.
 *
 * Anything unreadable throws a fixed-text error and never returns a partial result, so the guard
 * can fail closed.
 */
export function requestFactsFrom(request: RawRequest): RequestFacts {
  const { method, rawHeaders } = request;
  const wellFormed =
    typeof method === 'string' &&
    Array.isArray(rawHeaders) &&
    rawHeaders.length % 2 === 0 &&
    rawHeaders.every((entry) => typeof entry === 'string');
  if (!wellFormed) throw new Error(UNREADABLE);

  const headers = rawHeaders as readonly string[];
  return {
    method,
    host: valuesOf(headers, 'host'),
    origin: valuesOf(headers, 'origin'),
    secFetchSite: valuesOf(headers, 'sec-fetch-site'),
  };
}
