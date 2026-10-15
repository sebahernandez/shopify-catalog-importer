import { SecretBoxError } from './secret-box-error.js';
import type { SecretBox } from './secret-box.port.js';

/**
 * A `SecretBox` whose real implementation is supplied later (design D4). The application is
 * created before the key is reconciled, so consumers receive this holder and `bootstrap()` binds
 * the real box once the keyring is final. Until then every call fails with `KEY_MISSING`; it
 * never falls back to another key.
 */
export class DeferredSecretBox implements SecretBox {
  #delegate: SecretBox | null = null;

  bind(delegate: SecretBox): void {
    if (this.#delegate !== null) {
      throw new SecretBoxError('KEY_MISSING', 'The secret box is already bound.');
    }
    this.#delegate = delegate;
  }

  encrypt(plaintext: string, context: string): string {
    return this.#resolve().encrypt(plaintext, context);
  }

  decrypt(envelope: string, context: string): string {
    return this.#resolve().decrypt(envelope, context);
  }

  #resolve(): SecretBox {
    if (this.#delegate === null) {
      throw new SecretBoxError('KEY_MISSING', 'The secret box is not ready yet.');
    }
    return this.#delegate;
  }
}
