/** Persists, per key id, an envelope of a fixed public constant used to detect a wrong key. */
export interface KeyCheckStore {
  read(keyId: string): Promise<string | null>;
  write(keyId: string, envelope: string): Promise<void>;
}
