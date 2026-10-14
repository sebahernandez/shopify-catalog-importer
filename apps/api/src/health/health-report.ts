import type { HealthResponse } from '@importer/contracts';

/** What the health route answers: the HTTP status and the shared response body. */
export interface HealthReply {
  readonly statusCode: 200 | 503;
  readonly body: HealthResponse;
}

/**
 * Turns the database check into the answer of `GET /health` (design, Interfaces): 200 with
 * `ok` and `up` when the database is reachable, 503 with `degraded` and `down` when it is not.
 * Both bodies have the same three fields; nothing else is ever added.
 *
 * The check is expected not to throw, but this function does not rely on it: a check that throws,
 * rejects or answers anything other than `true` counts as the database being down. The error is
 * dropped here on purpose, so no message can reach the body.
 */
export async function reportHealth(
  isReachable: () => Promise<boolean>,
  shopifyApiVersion: string,
): Promise<HealthReply> {
  let reachable: boolean;
  try {
    reachable = (await isReachable()) === true;
  } catch {
    reachable = false;
  }
  return reachable
    ? { statusCode: 200, body: { status: 'ok', database: 'up', shopifyApiVersion } }
    : { statusCode: 503, body: { status: 'degraded', database: 'down', shopifyApiVersion } };
}
