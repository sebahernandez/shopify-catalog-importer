const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a well-formed store id; a malformed id is answered like an unknown one. */
export const isStoreId = (id: string): boolean => UUID.test(id);
