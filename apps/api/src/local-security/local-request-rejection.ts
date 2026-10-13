import type { RejectionCode } from './request-policy.js';

/**
 * The text of each rejection. It names the check that failed and nothing about the request, so a
 * rejection can never echo a header value back to the caller.
 */
export const REJECTION_MESSAGES: Readonly<Record<RejectionCode, string>> = {
  HOST_NOT_ALLOWED: 'host not allowed',
  ORIGIN_NOT_ALLOWED: 'origin not allowed',
};

/** Both checks fail the same way: 403, with the shared `ApiError` body (built by the filter). */
export const REJECTION_STATUS = 403;

/**
 * Thrown by the guard when a request is rejected. It carries the code only: the message is the
 * fixed text for that code, and nothing from the request is attached.
 */
export class LocalRequestRejection extends Error {
  readonly status = REJECTION_STATUS;
  readonly code: RejectionCode;

  constructor(code: RejectionCode) {
    super(REJECTION_MESSAGES[code]);
    this.name = 'LocalRequestRejection';
    this.code = code;
  }
}
