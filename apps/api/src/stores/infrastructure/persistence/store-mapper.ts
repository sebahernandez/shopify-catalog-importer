import { AUTH_KINDS, STORE_STATUSES, VerificationSnapshot } from '@importer/contracts';
import type { LoggerPort } from '../../../shared-kernel/logging/logger.port.js';
import type { ShopDomain } from '../../domain/shop-domain.js';
import type { Store } from '../../domain/store.js';

/** The columns of the `store` table as Prisma returns them. */
export interface StoreRow {
  readonly id: string;
  readonly displayName: string;
  readonly shopDomain: string;
  readonly shopifyShopId: string | null;
  readonly apiVersion: string | null;
  readonly authKind: string;
  readonly credentialsEnvelope: string;
  readonly status: string;
  readonly lastVerifiedAt: Date | null;
  readonly lastVerification: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Fixed text on purpose: a row value (or a zod issue that quotes one) never reaches a message. */
const invalidRow = (): Error => new Error('A stored store row is not valid.');

/** A corrupt snapshot reads as null and raises one warning event without any row content. */
function readSnapshot(text: string | null, logger: LoggerPort): VerificationSnapshot | null {
  if (text === null) return null;
  try {
    const parsed = VerificationSnapshot.safeParse(JSON.parse(text));
    if (parsed.success) return parsed.data;
  } catch {
    // Falls through to the warning below.
  }
  logger.warn('store.last_verification.corrupt');
  return null;
}

export function toStore(row: StoreRow, logger: LoggerPort): Store {
  const status = STORE_STATUSES.safeParse(row.status);
  const authKind = AUTH_KINDS.safeParse(row.authKind);
  if (!status.success || !authKind.success) throw invalidRow();
  return {
    id: row.id,
    displayName: row.displayName,
    // Stored values were canonicalised by the domain parser before they were written.
    shopDomain: row.shopDomain as ShopDomain,
    shopifyShopId: row.shopifyShopId,
    apiVersion: row.apiVersion,
    authKind: authKind.data,
    credentialsEnvelope: row.credentialsEnvelope,
    status: status.data,
    lastVerifiedAt: row.lastVerifiedAt?.toISOString() ?? null,
    lastVerification: readSnapshot(row.lastVerification, logger),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
