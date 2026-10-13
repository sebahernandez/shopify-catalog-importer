import type { IncomingMessage, ServerResponse } from 'node:http';

/** Methods a cross-origin page may use (design D7). `HEAD` and `OPTIONS` are not listed. */
export const CORS_ALLOWED_METHODS = 'GET,POST,PUT,PATCH,DELETE';
/** The one request header a cross-origin page may send (design D7). */
export const CORS_ALLOWED_HEADERS = 'Content-Type';

export type CorsMiddleware = (req: IncomingMessage, res: ServerResponse, next: () => void) => void;

const BAD_ORIGIN = 'CORS policy: an allowed origin is not a canonical origin.';

/** Throws unless the value is an `http(s)` origin that equals its own canonical form. */
function assertCanonicalOrigin(origin: string): void {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error(BAD_ORIGIN);
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.origin !== origin) {
    throw new Error(BAD_ORIGIN);
  }
}

/**
 * The CORS policy of design D7 as a plain Node middleware: an exact-match allow-list, no
 * wildcard, no credentials, `Vary: Origin` on every response, and no `Access-Control-*` header at
 * all for any other origin.
 *
 * It is hand-written instead of Nest's `enableCors` because the `cors` package cannot do both
 * halves of that policy: with a list it still sends `Allow-Methods` and `Allow-Headers` to a
 * foreign preflight, and with an origin callback it drops `Vary: Origin` for foreign origins.
 *
 * A preflight (an `OPTIONS` request with `Origin` and `Access-Control-Request-Method`) is
 * answered here with `204` and never reaches the router, so no handler can be run or registered
 * for it. Any other `OPTIONS` request is left to the router like every other request.
 */
export function createCorsMiddleware(allowedOrigins: readonly string[]): CorsMiddleware {
  for (const origin of allowedOrigins) assertCanonicalOrigin(origin);
  const allowed = new Set(allowedOrigins);

  return (req, res, next) => {
    res.appendHeader('Vary', 'Origin');
    const origin = req.headers.origin;
    const isAllowed = origin !== undefined && allowed.has(origin);
    if (isAllowed) res.setHeader('Access-Control-Allow-Origin', origin);

    const isPreflight =
      req.method === 'OPTIONS' &&
      origin !== undefined &&
      req.headers['access-control-request-method'] !== undefined;
    if (!isPreflight) return next();

    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Methods', CORS_ALLOWED_METHODS);
      res.setHeader('Access-Control-Allow-Headers', CORS_ALLOWED_HEADERS);
    }
    res.statusCode = 204;
    res.setHeader('Content-Length', '0');
    res.end();
  };
}
