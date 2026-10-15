/** The store does not exist (or its id is malformed). Fixed message: nothing is echoed. */
export class StoreNotFoundError extends Error {
  constructor() {
    super('The store was not found.');
    this.name = 'StoreNotFoundError';
  }
}
