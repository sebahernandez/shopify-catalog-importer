# Delta for Secret Protection

Every other requirement of this capability (authenticated encryption round trip, tamper and wrong-key rejection, external key) is unchanged.

## RENAMED Requirements

### Requirement: No credential persistence in S0 → Credentials encrypted at rest per store

(Reason: from S2 the application stores Shopify credentials, so the S0 prohibition no longer holds.)
(Migration: tests that asserted an empty secret storage are replaced by the scenarios below; the baseline-only database check applies to a database migrated up to the baseline only.)

## MODIFIED Requirements

### Requirement: Credentials encrypted at rest per store

The only credentials the application MAY persist are Shopify store credentials, and they MUST be persisted only as one `SecretBox` envelope per store, encrypted with the context `store:<id>:credentials` bound to that store's id. No plaintext credential, token, client secret or masked form of them MUST be stored in any column, file or log, and no table other than `store` MUST hold a credential. An envelope MUST NOT decrypt under any other context.
(Previously: "S0 MUST NOT persist any credential; the persistence baseline holds no secret column in use.")

#### Scenario: Database after the baseline only

- GIVEN a database migrated only to the baseline migration
- WHEN its contents are inspected
- THEN it contains no stored credential

#### Scenario: Envelope only after create

- GIVEN a store created with canary credentials
- WHEN every column of every table is read
- THEN the canaries appear nowhere, and the only credential-bearing column is the store envelope, which starts with `sb1.`

#### Scenario: Bound to the store id

- GIVEN the envelope of store A
- WHEN it is decrypted with the context of store B
- THEN decryption fails with `DECRYPT_FAILED`

#### Scenario: Removed with the store

- GIVEN a store with an envelope
- WHEN the store is deleted
- THEN no envelope for it remains in the database

## ADDED Requirements

### Requirement: Injectable SecretBox after key reconciliation

The application MUST provide `SecretBox` to other modules through a dependency token (`SECRET_BOX`) whose implementation is bound exactly once during boot, after the database connects and the key has been loaded and reconciled with the stored key check, using the same keyring as the redactor registration. Consumers MUST resolve it at call time, not at construction. Using it before it is bound MUST fail explicitly with a `SecretBoxError` that does not reveal key material, and MUST NOT fall back to another key or to plaintext. A failure of key reconciliation MUST abort startup before the token is bound.

#### Scenario: Bound after boot

- GIVEN a booted application
- WHEN a store is created and verified through the HTTP routes
- THEN credentials are encrypted and decrypted with the reconciled key

#### Scenario: Use before binding

- GIVEN the token has not yet been bound
- WHEN a consumer calls `encrypt` or `decrypt`
- THEN it fails with a `SecretBoxError` and nothing is stored

#### Scenario: Reconciliation failure

- GIVEN a key file that does not match the stored key check
- WHEN the application boots
- THEN startup aborts as before and the token is never bound

#### Scenario: Single keyring

- GIVEN a booted application
- WHEN a decrypted canary is printed through the application logger
- THEN it appears as `[REDACTED]`, because the keyring used by the token is the one registered with the redactor
