import { ShopifyGatewayError } from '../../ports/shopify-gateway-error.js';

export type SimulatorOperation = 'getShopInfo' | 'getGrantedScopes' | 'listLocations';

/** A fault that makes the call throw a `ShopifyGatewayError` of `kind`. */
export type ThrowingFault =
  | { readonly kind: 'THROTTLED'; readonly retryAfterMs?: number }
  | {
      readonly kind:
        | 'AUTH_FAILED'
        | 'SCOPE_MISSING'
        | 'NETWORK'
        | 'TIMEOUT'
        | 'SERVER_ERROR'
        | 'INVALID_RESPONSE';
    };

/** Fall-forward: the call succeeds, served by `apiVersionUsed` instead of the requested version. */
export interface VersionFallForward {
  readonly kind: 'VERSION_UNSUPPORTED';
  readonly apiVersionUsed?: string;
}

export type SimulatorFault = ThrowingFault | VersionFallForward;

/** The outcome of one call: success with the version served, or a thrown error. */
export type FaultOutcome = { readonly apiVersionUsed: string };

/** A later version than the requested one (same month, next year), as a fall-forward would serve. */
const fallForwardOf = (requested: string): string =>
  `${Number(requested.slice(0, 4)) + 1}${requested.slice(4)}`;

/** Scripted faults, keyed by operation and 1-based call number (per operation). */
export class SimulatorFaults {
  private readonly scripted = new Map<string, SimulatorFault>();
  private readonly standing = new Map<SimulatorOperation, SimulatorFault>();
  private readonly counts = new Map<SimulatorOperation, number>();

  /** Fault only call number `call` (1-based) of `operation`. */
  on(operation: SimulatorOperation, call: number, fault: SimulatorFault): void {
    this.scripted.set(`${operation}#${call}`, fault);
  }

  /** Fault every call of `operation`. */
  always(operation: SimulatorOperation, fault: SimulatorFault): void {
    this.standing.set(operation, fault);
  }

  /**
   * Counts the call, throws when a throwing fault applies, and returns the version to report:
   * the requested one, or the fall-forward one.
   */
  apply(operation: SimulatorOperation, requestedVersion: string): FaultOutcome {
    const call = (this.counts.get(operation) ?? 0) + 1;
    this.counts.set(operation, call);
    const fault = this.scripted.get(`${operation}#${call}`) ?? this.standing.get(operation);
    if (fault === undefined) return { apiVersionUsed: requestedVersion };
    if (fault.kind === 'VERSION_UNSUPPORTED') {
      return { apiVersionUsed: fault.apiVersionUsed ?? fallForwardOf(requestedVersion) };
    }
    throw new ShopifyGatewayError(
      fault.kind,
      fault.kind === 'THROTTLED' && fault.retryAfterMs !== undefined
        ? { retryAfterMs: fault.retryAfterMs }
        : {},
    );
  }
}
