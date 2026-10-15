import {
  REQUIRED_CAPABILITIES,
  type ExchangeFailureReason,
  type ShopifyErrorKind,
  type StoreStatus,
  type StoreVerification,
  type VerificationProblem,
  type VerificationSnapshot,
} from '@importer/contracts';
import { diffScopes } from '../domain/scope-diff.js';
import { statusFromProblems } from '../domain/verification-status.js';
import type { Location, ShopInfo } from '../ports/shopify-gateway.port.js';

/** What stopped the sequence: a gateway failure, or credentials that could not be read. */
export type VerificationFailure =
  | {
      readonly kind: ShopifyErrorKind;
      readonly reason?: ExchangeFailureReason;
      /** True when the failing call was `listLocations`. */
      readonly onLocations?: boolean;
    }
  | 'CREDENTIALS_UNREADABLE';

export interface VerificationParts {
  readonly checkedAt: string;
  readonly requestedVersion: string;
  readonly shop: ShopInfo | null;
  /** Null when the scopes were not read. */
  readonly granted: readonly string[] | null;
  readonly locations: readonly Location[];
  readonly locationsTruncated: boolean;
  /** `apiVersionUsed` of every read that succeeded. */
  readonly versionsUsed: readonly (string | null)[];
  readonly failure: VerificationFailure | null;
}

export interface AssembledVerification {
  readonly result: StoreVerification;
  readonly status: StoreStatus;
}

const failureProblem = (failure: VerificationFailure) =>
  failure === 'CREDENTIALS_UNREADABLE'
    ? { kind: 'AUTH_FAILED' as const, code: 'CREDENTIALS_UNREADABLE' as const, params: {} }
    : {
        kind: failure.kind,
        code: failure.kind,
        params:
          failure.kind === 'CREDENTIAL_EXCHANGE_FAILED'
            ? { reason: failure.reason ?? 'UNKNOWN' }
            : {},
      };

/** Pure: builds the result, its status and the problems; params never hold response text. */
export function assembleVerification(parts: VerificationParts): AssembledVerification {
  const { failure, granted, requestedVersion } = parts;
  const scopeDenied =
    failure !== null && typeof failure === 'object' && failure.kind === 'SCOPE_MISSING';
  const missingSet = new Set<string>(
    granted === null ? REQUIRED_CAPABILITIES : diffScopes(granted).missing,
  );
  if (scopeDenied && failure.onLocations === true) missingSet.add('locations');
  const missing = REQUIRED_CAPABILITIES.filter((capability) => missingSet.has(capability));

  const problems: VerificationProblem[] = [];
  if (failure !== null && !scopeDenied) problems.push(failureProblem(failure));
  if (scopeDenied || (granted !== null && missing.length > 0)) {
    problems.push({ kind: 'SCOPE_MISSING', code: 'SCOPE_MISSING', params: { missing } });
  }

  const nonNull = parts.versionsUsed.filter((v): v is string => v !== null);
  const used = nonNull.find((v) => v !== requestedVersion) ?? nonNull[0] ?? null;
  if (used !== null && used !== requestedVersion) {
    problems.push({
      kind: 'VERSION_UNSUPPORTED',
      code: 'API_VERSION_MISMATCH',
      params: { requested: requestedVersion, used },
    });
  }

  const { shop } = parts;
  const result: StoreVerification = {
    ok: problems.length === 0,
    checkedAt: parts.checkedAt,
    shop:
      shop === null
        ? null
        : {
            id: shop.id,
            name: shop.name,
            currencyCode: shop.currencyCode,
            planName: shop.planName,
            shopifyPlus: shop.shopifyPlus,
            partnerDevelopment: shop.partnerDevelopment,
          },
    apiVersion: { requested: requestedVersion, used },
    scopes: { granted: [...(granted ?? [])], required: [...REQUIRED_CAPABILITIES], missing },
    locations: parts.locations.map((l) => ({ ...l })),
    locationsTruncated: parts.locationsTruncated,
    problems,
  };
  return { result, status: statusFromProblems(problems.map((p) => p.kind)) };
}

/** The stored form: `locations` becomes `locationCount`, so no location name or id persists. */
export function toSnapshot(result: StoreVerification): VerificationSnapshot {
  const { locations, ...rest } = result;
  return { ...rest, locationCount: locations.length };
}
