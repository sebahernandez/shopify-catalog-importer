import type { ApiError } from '@importer/contracts';
import type { GuardPolicy } from './allowed-origins.js';

/** What the request carried for one header: absent, one value, or several (a repeated header). */
export type HeaderValue = string | readonly string[] | undefined;

/** The only facts about a request the decision uses. Nothing else is read from the request. */
export interface RequestFacts {
  readonly method: string;
  readonly host: HeaderValue;
  readonly origin: HeaderValue;
  readonly secFetchSite: HeaderValue;
}

export type RejectionCode = ApiError['error']['code'];

export type GuardDecision =
  { readonly allowed: true } | { readonly allowed: false; readonly code: RejectionCode };

// Exact, case-sensitive: anything else, including a lower-case or unknown method, is treated as
// state-changing, so an unusual verb gets the stricter rules and never the looser ones.
const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

// With no Origin, only a browser-set value that says "not a cross-site request" is enough.
const SAME_SITE_FREE: ReadonlySet<string> = new Set(['same-origin', 'none']);

const allow: GuardDecision = { allowed: true };
const reject = (code: RejectionCode): GuardDecision => ({ allowed: false, code });

/**
 * Design D7, rules 1 to 3, as one total function: it never throws and has no allow-by-default
 * path. A value is accepted only when a rule names it, so a repeated header, a non-string or an
 * unknown value falls through to a rejection.
 *
 * 1. Every method: `Host` must be on the allow-list (first, because it needs no other fact).
 * 2. A state-changing method with an `Origin`: it must be an allowed origin; `Sec-Fetch-Site`
 *    is not consulted, because it is not authentication and a legitimate cross-site call from the
 *    web application carries an allowed `Origin` with `Sec-Fetch-Site: cross-site`.
 * 3. A state-changing method with no `Origin`: `Sec-Fetch-Site` must be absent, `same-origin` or
 *    `none`.
 */
export function evaluateRequest(policy: GuardPolicy, request: RequestFacts): GuardDecision {
  const { host, origin, secFetchSite } = request;
  if (typeof host !== 'string' || !policy.allowedHosts.has(host)) return reject('HOST_NOT_ALLOWED');

  if (typeof request.method === 'string' && SAFE_METHODS.has(request.method)) return allow;

  if (origin !== undefined) {
    return typeof origin === 'string' && policy.allowedOrigins.has(origin)
      ? allow
      : reject('ORIGIN_NOT_ALLOWED');
  }
  if (secFetchSite === undefined) return allow;
  return typeof secFetchSite === 'string' && SAME_SITE_FREE.has(secFetchSite)
    ? allow
    : reject('ORIGIN_NOT_ALLOWED');
}
