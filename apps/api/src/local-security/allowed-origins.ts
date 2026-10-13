/**
 * The two allow-lists the local request guard compares headers against. Both hold canonical
 * strings and are matched by exact, case-sensitive equality: there is no pattern, prefix or
 * suffix matching anywhere, which is what keeps look-alike names such as
 * `127.0.0.1.evil.test` out.
 */
export interface GuardPolicy {
  /** `host` or `host:port`, in the form a browser writes it in a `Host` header. */
  readonly allowedHosts: ReadonlySet<string>;
  /** Serialised origins (`scheme://host[:port]`), in the form of an `Origin` header. */
  readonly allowedOrigins: ReadonlySet<string>;
}

export interface GuardPolicyInput {
  readonly apiHost: string;
  readonly apiPort: number;
  readonly allowedOrigins: readonly string[];
}

const BAD_ORIGIN = 'Local request guard: an allowed origin is not canonical.';
const BAD_API_ADDRESS = 'Local request guard: the API host or port is not usable.';

/** The canonical URL of `http://host:port`, or throws. IPv6 is bracketed here, as in a Host header. */
function ownUrl(apiHost: string, apiPort: number): URL {
  if (!Number.isInteger(apiPort) || apiPort < 1 || apiPort > 65535)
    throw new Error(BAD_API_ADDRESS);
  const host = apiHost.includes(':') ? `[${apiHost}]` : apiHost;
  let url: URL;
  try {
    url = new URL(`http://${host}:${apiPort}`);
  } catch {
    throw new Error(BAD_API_ADDRESS);
  }
  // A host such as `a/b` or `u@h` parses, but into a path or userinfo instead of a host.
  const onlyAuthority =
    url.pathname === '/' &&
    url.username === '' &&
    url.password === '' &&
    url.search === '' &&
    url.hash === '';
  if (!onlyAuthority || url.hostname === '') throw new Error(BAD_API_ADDRESS);
  return url;
}

/** The URL of a configured origin, only when it is already its own canonical http(s) origin. */
function canonicalOrigin(origin: string): URL {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error(BAD_ORIGIN);
  }
  const canonical =
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    url.origin === origin &&
    !origin.includes('*');
  if (!canonical) throw new Error(BAD_ORIGIN);
  return url;
}

/**
 * Derives the allow-lists from the validated configuration (design D7, rules 1 and 2). Allowed
 * hosts: the API's own host and port, and the host of every allowed origin. Allowed origins:
 * every configured origin and the API's own origin. The loopback spelling that was not
 * configured is not added. Anything unusable throws with fixed text that never carries a value,
 * so the application cannot start with a guard it cannot trust.
 */
export function buildGuardPolicy(input: GuardPolicyInput): GuardPolicy {
  const own = ownUrl(input.apiHost, input.apiPort);
  const allowedHosts = new Set<string>([own.host]);
  const allowedOrigins = new Set<string>([own.origin]);
  for (const origin of input.allowedOrigins) {
    const url = canonicalOrigin(origin);
    allowedHosts.add(url.host);
    allowedOrigins.add(url.origin);
  }
  return { allowedHosts, allowedOrigins };
}
