import type { AuthKind } from '@importer/contracts';
import type { PrismaService } from '../../../persistence/prisma.service.js';
import type { LoggerPort } from '../../../shared-kernel/logging/logger.port.js';
import type { Clock } from '../../../shared-kernel/time/clock.port.js';
import type { Store } from '../../domain/store.js';
import { replaceCredentials } from '../../domain/store-rules.js';
import {
  DuplicateShopDomainError,
  type StoreRepository,
  type VerificationRecord,
} from '../../ports/store-repository.port.js';
import { toStore } from './store-mapper.js';

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';

/** Driver errors can quote bound values (the envelope), so none of them is passed on. */
const failed = (): Error => new Error('The store repository operation failed.');

export class PrismaStoreRepository implements StoreRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly logger: LoggerPort,
  ) {}

  async insert(store: Store): Promise<void> {
    const { lastVerification, lastVerifiedAt, createdAt, updatedAt, ...rest } = store;
    try {
      await this.prisma.client.store.create({
        data: {
          ...rest,
          lastVerifiedAt: lastVerifiedAt === null ? null : new Date(lastVerifiedAt),
          lastVerification: lastVerification === null ? null : JSON.stringify(lastVerification),
          createdAt: new Date(createdAt),
          updatedAt: new Date(updatedAt),
        },
      });
    } catch (error) {
      throw isUniqueViolation(error) ? new DuplicateShopDomainError() : failed();
    }
  }

  async findById(id: string): Promise<Store | null> {
    const row = await this.prisma.client.store.findUnique({ where: { id } }).catch(() => {
      throw failed();
    });
    return row === null ? null : toStore(row, this.logger);
  }

  async list(): Promise<Store[]> {
    const rows = await this.prisma.client.store
      .findMany({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
      .catch(() => {
        throw failed();
      });
    return rows.map((row) => toStore(row, this.logger));
  }

  async replaceCredentials(
    id: string,
    next: { readonly authKind: AuthKind; readonly credentialsEnvelope: string },
  ): Promise<Store | null> {
    const current = await this.findById(id);
    if (current === null) return null;
    const nowIso = new Date(this.clock.nowMs()).toISOString();
    const updated = replaceCredentials(current, next, nowIso);
    await this.prisma.client.store
      .update({
        where: { id },
        data: {
          authKind: updated.authKind,
          credentialsEnvelope: updated.credentialsEnvelope,
          status: updated.status,
          shopifyShopId: null,
          apiVersion: null,
          lastVerifiedAt: null,
          lastVerification: null,
          updatedAt: new Date(updated.updatedAt),
        },
      })
      .catch(() => {
        throw failed();
      });
    return updated;
  }

  async recordVerification(
    id: string,
    expectedEnvelope: string,
    record: VerificationRecord,
  ): Promise<boolean> {
    const result = await this.prisma.client.store
      .updateMany({
        where: { id, credentialsEnvelope: expectedEnvelope },
        data: {
          status: record.status,
          lastVerifiedAt: new Date(record.lastVerifiedAt),
          ...(record.shopifyShopId === null ? {} : { shopifyShopId: record.shopifyShopId }),
          apiVersion: record.apiVersion,
          lastVerification: JSON.stringify(record.snapshot),
        },
      })
      .catch(() => {
        throw failed();
      });
    return result.count > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.prisma.client.store.deleteMany({ where: { id } }).catch(() => {
      throw failed();
    });
    return result.count > 0;
  }
}
