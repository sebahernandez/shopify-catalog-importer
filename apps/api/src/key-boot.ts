import { BootError } from './shared-kernel/boot-error.js';
import { registerSecret } from './shared-kernel/logging/redact.js';
import type { KeyCheckStore } from './shared-kernel/secret-box/key-check-store.port.js';
import type { KeyProvider, Keyring } from './shared-kernel/secret-box/key-provider.port.js';
import { KeyFileError } from './shared-kernel/secret-box/infrastructure/file-key-provider.js';
import {
  SecretKeyBootstrap,
  type BootstrapResult,
} from './shared-kernel/secret-box/secret-key-bootstrap.js';

/**
 * Every textual form the key can take in a log line: the base64 of the key file (padded, and
 * without padding), base64url (padded, and without padding) and hex (lower and upper case).
 * Forms that coincide, such as base64 and base64url of a key with no `+` or `/`, are listed once.
 * A secret cut into pieces, split across fields or encoded some other way is not covered.
 */
export function keyForms(key: Uint8Array): string[] {
  const bytes = Buffer.from(key);
  try {
    const base64 = bytes.toString('base64');
    const base64url = bytes.toString('base64url');
    const hex = bytes.toString('hex');
    return [
      ...new Set([
        base64,
        base64.replace(/=+$/, ''),
        base64url,
        base64url.padEnd(base64.length, '='),
        hex,
        hex.toUpperCase(),
      ]),
    ];
  } finally {
    bytes.fill(0);
  }
}

/**
 * Registers every form of every key in the ring with the redactor, so none of them can reach a
 * log line from now on. Returns how many forms were registered.
 */
export function registerKeyring(keyring: Keyring): number {
  let registered = 0;
  for (const key of keyring.keys.values()) {
    for (const form of keyForms(key)) if (registerSecret(form)) registered += 1;
  }
  return registered;
}

/** Prisma's error code for a violated unique constraint, here the key-check primary key. */
export function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

/**
 * Runs the secret-key bootstrap. The store writes insert-only, so a second start that read "no
 * row" and then lost the race gets a duplicate-key error. It runs the bootstrap exactly once
 * more: that run reads the winner's row and verifies against it (a different key aborts with
 * `KEY_MISMATCH`). A second duplicate-key error aborts with `KEY_CHECK_CONFLICT`. No other
 * failure is retried.
 */
export async function reconcileKey(
  provider: KeyProvider,
  store: KeyCheckStore,
): Promise<BootstrapResult> {
  try {
    return await new SecretKeyBootstrap(provider, store).run();
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }
  try {
    return await new SecretKeyBootstrap(provider, store).run();
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    throw new BootError(
      'KEY_CHECK_CONFLICT',
      'Another start wrote the key-check record at the same time, twice in a row. Start again.',
    );
  }
}

/**
 * Reads the key file ahead of everything else (design boot diagram), so a malformed or too
 * permissive file stops the start before an application exists, and so a key that is already
 * there can be registered with the redactor before the first log line. Creates nothing.
 */
export function loadKeyring(provider: KeyProvider): Keyring | null {
  try {
    return provider.load();
  } catch (error) {
    if (error instanceof KeyFileError) throw new BootError('KEY_FILE_INVALID', error.message);
    throw error;
  }
}
