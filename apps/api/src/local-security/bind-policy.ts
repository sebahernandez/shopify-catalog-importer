import { isIPv4, isIPv6 } from 'node:net';
import type { AddressInfo } from 'node:net';
import { BootError } from '../shared-kernel/boot-error.js';

/** IPv6 loopback is exactly `::1` in any spelling; IPv4-mapped forms are deliberately refused. */
function isIpv6Loopback(address: string): boolean {
  try {
    return new URL(`http://[${address}]`).hostname === '[::1]';
  } catch {
    return false;
  }
}

/**
 * True for an address literal inside `127.0.0.0/8` or equal to `::1`. This is the form a socket
 * reports, so a name is never loopback here.
 */
export function isLoopbackAddress(address: string): boolean {
  if (isIPv4(address)) return address.startsWith('127.');
  return isIPv6(address) && isIpv6Loopback(address);
}

/**
 * Loopback as the configuration schema defines it: a loopback address literal or the name
 * `localhost`. It takes the normalised host the schema returns (lower-case, no brackets).
 * A test keeps this in step with the schema's own rule.
 */
export function isLoopbackHost(host: string): boolean {
  return host.toLowerCase() === 'localhost' || isLoopbackAddress(host);
}

/**
 * Checks the address the server is really bound to, as reported by `server.address()`. The
 * schema accepts the name `localhost` as loopback, but the resolver decides what it means, so the
 * decision is made on the socket and not on the configured text. A bound address that is not
 * loopback is only acceptable with the explicit opt-in.
 */
export function verifyBoundAddress(
  address: AddressInfo | string | null,
  allowNonLoopback: boolean,
): AddressInfo {
  if (address === null || typeof address === 'string') {
    throw new BootError(
      'BIND_ADDRESS_NOT_ALLOWED',
      'The server is not bound to a network address, so API_HOST could not be verified.',
    );
  }
  if (!allowNonLoopback && !isLoopbackAddress(address.address)) {
    throw new BootError(
      'BIND_ADDRESS_NOT_ALLOWED',
      `API_HOST resolved to the non-loopback address ${address.address}. ` +
        'Use a loopback address, or set ALLOW_NON_LOOPBACK=true to bind it on purpose.',
    );
  }
  return address;
}

export interface NonLoopbackBindInput {
  readonly host: string;
  readonly port: number;
  readonly allowNonLoopback: boolean;
  /** The `Host` header values the request guard will accept, from the same configuration. */
  readonly acceptedHosts: ReadonlySet<string>;
}

export interface NonLoopbackBindEvent {
  readonly event: 'non_loopback_bind';
  readonly host: string;
  readonly port: number;
  readonly acceptedHosts: readonly string[];
  readonly message: string;
}

/**
 * The single warning for a deliberate non-loopback bind (design D7), or `null` when there is
 * nothing to warn about. It lists the `Host` values the guard accepts: the guard derives them
 * from configuration only, so a client using any other `Host` gets a 403 until the operator
 * adds the externally used origin to `ALLOWED_ORIGINS`.
 */
export function nonLoopbackBindEvent(input: NonLoopbackBindInput): NonLoopbackBindEvent | null {
  if (!input.allowNonLoopback || isLoopbackHost(input.host)) return null;
  return {
    event: 'non_loopback_bind',
    host: input.host,
    port: input.port,
    acceptedHosts: [...input.acceptedHosts].sort(),
    message:
      'The API is bound to a non-loopback address and has no authentication. ' +
      'Requests are accepted only for the listed Host values; add the externally used origin ' +
      'to ALLOWED_ORIGINS or every other client is answered with 403.',
  };
}
