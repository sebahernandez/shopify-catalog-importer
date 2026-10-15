/** Injection tokens for the stores module; the Nest wiring binds them. */
export const STORE_REPOSITORY = Symbol('STORE_REPOSITORY');
export const CREDENTIAL_VAULT = Symbol('CREDENTIAL_VAULT');
export const CREDENTIAL_PROVIDER_REGISTRY = Symbol('CREDENTIAL_PROVIDER_REGISTRY');
export const SHOPIFY_GATEWAY = Symbol('SHOPIFY_GATEWAY');
export const STORES_CLOCK = Symbol('STORES_CLOCK');
export const ID_GENERATOR = Symbol('ID_GENERATOR');
export const STORES_SECRET_BOX = Symbol('STORES_SECRET_BOX');
export const STORES_CONFIG = Symbol('STORES_CONFIG');
