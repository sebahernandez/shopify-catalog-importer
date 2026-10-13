import type { KeyCheckStore } from '../shared-kernel/secret-box/key-check-store.port.js';
import type { PrismaService } from './prisma.service.js';

/** Stores the public key-check envelope separately from other application settings. */
export class PrismaKeyCheckStore implements KeyCheckStore {
  constructor(private readonly prisma: PrismaService) {}

  async read(keyId: string): Promise<string | null> {
    const row: { value: string } | null = await this.prisma.client.appSetting.findUnique({
      where: { key: `secret-key-check:${keyId}` },
      select: { value: true },
    });
    return row?.value ?? null;
  }

  /**
   * Insert only: another bootstrap may have written the check since our caller read it.
   * The primary key rejects that race; never replace the envelope or hide the conflict.
   */
  async write(keyId: string, envelope: string): Promise<void> {
    await this.prisma.client.appSetting.create({
      data: { key: `secret-key-check:${keyId}`, value: envelope },
    });
  }
}
