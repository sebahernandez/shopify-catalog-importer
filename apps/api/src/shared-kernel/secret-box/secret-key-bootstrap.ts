import { BootError } from '../boot-error.js';
import { AesGcmSecretBox } from './infrastructure/aes-gcm-secret-box.js';
import { FIRST_KEY_ID, KeyFileError } from './infrastructure/file-key-provider.js';
import type { KeyCheckStore } from './key-check-store.port.js';
import type { KeyProvider, Keyring } from './key-provider.port.js';
import { SecretBoxError } from './secret-box-error.js';

/** Public, fixed value. Its envelope proves a key opens this database; it is not a credential. */
export const KEY_CHECK_PLAINTEXT = 'shopify-catalog-importer:key-check:v1';
export const KEY_CHECK_CONTEXT = 'secret-key-check';

/** What the bootstrap did: `generated` is the moment to warn the operator to back up the key. */
export type BootstrapOutcome = 'generated' | 'recorded' | 'verified';

export interface BootstrapResult {
  readonly keyring: Keyring;
  readonly outcome: BootstrapOutcome;
}

/**
 * Decides at start-up whether to generate the key, record its key-check row or verify it
 * against the stored row (design D4). It throws `BootError` and never exits, logs or regenerates
 * a key when the database already holds a key-check row.
 */
export class SecretKeyBootstrap {
  constructor(
    private readonly provider: KeyProvider,
    private readonly store: KeyCheckStore,
  ) {}

  async run(): Promise<BootstrapResult> {
    const existing = this.guard(() => this.provider.load());
    if (existing === null) return this.generateFirstKey();

    const row = await this.store.read(existing.activeKeyId);
    if (row === null) {
      await this.writeRow(existing);
      return { keyring: existing, outcome: 'recorded' };
    }
    this.verifyRow(existing, row);
    return { keyring: existing, outcome: 'verified' };
  }

  private async generateFirstKey(): Promise<BootstrapResult> {
    // A row without its key file means the key was lost. Generating a new one would orphan every
    // stored secret without a sound, so the database is consulted before anything is created.
    if ((await this.store.read(FIRST_KEY_ID)) !== null) {
      throw new BootError(
        'KEY_FILE_REQUIRED',
        'The database holds a key-check record but the key file (SECRET_KEY_FILE) was not found. ' +
          'Restore the key file from a backup; a new key is never generated for this database.',
      );
    }
    const keyring = this.guard(() => this.provider.generate());
    await this.writeRow(keyring);
    return { keyring, outcome: 'generated' };
  }

  private async writeRow(keyring: Keyring): Promise<void> {
    const envelope = new AesGcmSecretBox(keyring).encrypt(KEY_CHECK_PLAINTEXT, KEY_CHECK_CONTEXT);
    await this.store.write(keyring.activeKeyId, envelope);
  }

  private verifyRow(keyring: Keyring, row: string): void {
    let plaintext: string | null = null;
    try {
      plaintext = new AesGcmSecretBox(keyring).decrypt(row, KEY_CHECK_CONTEXT);
    } catch (error) {
      if (!(error instanceof SecretBoxError)) throw error;
    }
    if (plaintext !== KEY_CHECK_PLAINTEXT) {
      throw new BootError(
        'KEY_MISMATCH',
        'The key file does not match this database: the stored key-check record cannot be opened with it.',
      );
    }
  }

  /** Turns a key file problem into the one error type the caller maps to an exit code. */
  private guard<T>(action: () => T): T {
    try {
      return action();
    } catch (error) {
      if (error instanceof KeyFileError) throw new BootError('KEY_FILE_INVALID', error.message);
      throw error;
    }
  }
}
