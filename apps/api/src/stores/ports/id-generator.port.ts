/** Source of new store ids, injected so tests can pin them. */
export interface IdGenerator {
  /** A new lower case UUID v4. */
  next(): string;
}
