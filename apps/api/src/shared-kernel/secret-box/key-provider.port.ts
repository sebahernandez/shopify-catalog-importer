/** A set of 32-byte keys by key id, and the id that new encryptions use. */
export interface Keyring {
  readonly activeKeyId: string;
  readonly keys: ReadonlyMap<string, Uint8Array>;
}

/** Source of the keyring. `load` returns `null` when no key exists yet. */
export interface KeyProvider {
  load(): Keyring | null;
  generate(): Keyring;
}
