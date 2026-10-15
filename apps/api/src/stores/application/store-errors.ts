import type { ValidationReport } from '@importer/contracts';
import type { ShopDomainReason } from '../domain/shop-domain.js';

/** The store does not exist (or its id is malformed). Fixed message: nothing is echoed. */
export class StoreNotFoundError extends Error {
  constructor() {
    super('The store was not found.');
    this.name = 'StoreNotFoundError';
  }
}

/** A store with the same canonical shop domain exists. Fixed message: the domain is not echoed. */
export class StoreAlreadyExistsError extends Error {
  constructor() {
    super('A store with this shop domain already exists.');
    this.name = 'StoreAlreadyExistsError';
  }
}

/** The shop domain input was refused; only the closed reason code is carried, never the input. */
export class StoreDomainInvalidError extends Error {
  constructor(readonly reason: ShopDomainReason) {
    super('The shop domain is not valid.');
    this.name = 'StoreDomainInvalidError';
  }
}

/** The credentials do not match a supported shape. Fixed message: no field value is echoed. */
export class StoreCredentialsInvalidError extends Error {
  constructor() {
    super('The credentials are not valid.');
    this.name = 'StoreCredentialsInvalidError';
  }
}

/** The display name is empty after trimming or longer than 80 characters. */
export class StoreDisplayNameInvalidError extends Error {
  constructor() {
    super('The display name is not valid.');
    this.name = 'StoreDisplayNameInvalidError';
  }
}

/** The request body is not the expected shape (unknown field, wrong type, missing member). */
export class StoreRequestInvalidError extends Error {
  constructor() {
    super('The request is not valid.');
    this.name = 'StoreRequestInvalidError';
  }
}

/** The store exists but is not `CONNECTED` (or its stored credentials cannot be read). */
export class StoreNotConnectedError extends Error {
  constructor() {
    super('The store is not connected.');
    this.name = 'StoreNotConnectedError';
  }
}

/**
 * The workbook has errors, so nothing was sent to Shopify. It carries the validation report,
 * which holds issue codes and row numbers, never cell contents beyond the product key.
 */
export class WorkbookInvalidError extends Error {
  constructor(readonly report: ValidationReport) {
    super('The workbook has errors.');
    this.name = 'WorkbookInvalidError';
  }
}

/** A Shopify read needed before any product was sent failed. Nothing was created. */
export class ShopifyRequestFailedError extends Error {
  constructor() {
    super('Shopify could not be reached.');
    this.name = 'ShopifyRequestFailedError';
  }
}
