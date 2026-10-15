# Delta for Store Verification

New capability. Verification checks, with three read calls, that a store's credentials work and that the app holds the scopes the importer will need. It writes nothing to Shopify. Items marked ASSUMPTION rest on documentation that does not state them. Nothing here was verified against a real store.

## ADDED Requirements

### Requirement: Verification flow and result shape

`VerifyStoreConnection` MUST read the store, obtain its credentials, and call `getShopInfo`, `getGrantedScopes` and `listLocations` in that order, using the API version from configuration (never the stored `apiVersion`). It MUST return a `StoreVerification` with: `ok` (boolean), `checkedAt` (ISO 8601 UTC from the injected clock), `shop` (`id`, `name`, `currencyCode`, `planName`, `shopifyPlus`, `partnerDevelopment`, or null when not obtained), `apiVersion` (`requested`, `used` or null), `scopes` (`granted`, `required`, `missing`, all string arrays), `locations` (array of `id`, `name`, `isActive`, `fulfillsOnlineOrders`), `locationsTruncated` (boolean) and `problems` (array). `ok` MUST be true if and only if `problems` is empty. Verification MUST NOT change `shopDomain`, `displayName` or credentials.

#### Scenario: Healthy store

- GIVEN a simulated shop granting all required scopes with 2 locations
- WHEN a store is verified
- THEN `ok` is true, `problems` is empty, `locations` has 2 entries and `apiVersion.requested` equals the configured version

#### Scenario: Call order

- GIVEN a recording simulator
- WHEN a store is verified
- THEN the calls are `getShopInfo`, `getGrantedScopes`, `listLocations` in that order

#### Scenario: Stored version ignored

- GIVEN a store whose stored `apiVersion` is `2026-07` and a configured version `2026-10`
- WHEN it is verified
- THEN requests use `2026-10` and the stored version is replaced by the result

#### Scenario: Unknown store

- GIVEN no store with the given id
- WHEN verification is requested
- THEN it fails with not found and no outbound call is made

### Requirement: Required capability set

The contracts package MUST define the required capability set as a constant: `write_products`, `write_files`, `write_inventory`, and `locations`, where `locations` is satisfied by any one of `read_locations`, `read_inventory` or `read_markets_home`. `scopes.required` MUST list the capability identifiers `write_products`, `write_files`, `write_inventory` and `locations`. ASSUMPTION: the scope rule for `locations` is not stated by the documentation (the research could not confirm which scope the query needs); the three alternatives come from the product decision. The scope needed by `stagedUploadsCreate` is unverified and is not part of the set.

#### Scenario: Constant content

- GIVEN the contracts constant
- WHEN it is read
- THEN it lists the four capabilities and the three alternatives for `locations`

#### Scenario: Required list in result

- GIVEN any verification result
- WHEN `scopes.required` is read
- THEN it equals `write_products`, `write_files`, `write_inventory`, `locations`

### Requirement: Scope diff with write-includes-read

A granted scope handle `write_<x>` MUST also count as `read_<x>`. A capability is met when a granted scope equals it (or, for `locations`, equals or implies one of its three alternatives). A read scope MUST NOT satisfy a write capability. `scopes.missing` MUST list the unmet capability identifiers in the order of `scopes.required`. `scopes.granted` MUST be the verbatim handles from Shopify.

#### Scenario: All met

- GIVEN granted `write_products`, `write_files`, `write_inventory`
- WHEN the diff is computed
- THEN `missing` is empty, because `write_inventory` implies `read_inventory` which satisfies `locations`

#### Scenario: Write scope missing

- GIVEN granted `read_products`, `write_files`, `write_inventory`
- WHEN the diff is computed
- THEN `missing` is `write_products`

#### Scenario: Locations by alternative

- GIVEN granted `write_products`, `write_files` and `read_locations`
- WHEN the diff is computed
- THEN `missing` is `write_inventory` and `locations` is not missing

#### Scenario: Locations unmet

- GIVEN granted `write_products`, `write_files` only
- WHEN the diff is computed
- THEN `missing` is `write_inventory`, `locations`

#### Scenario: Read does not satisfy write

- GIVEN granted `read_files`
- WHEN the diff is computed
- THEN `write_files` is in `missing`

### Requirement: Problems are typed

Each entry of `problems` MUST have `kind` (a gateway error kind), `code` and `params`. `code` MUST equal `kind`, except: a version mismatch uses kind `VERSION_UNSUPPORTED` and code `API_VERSION_MISMATCH` with params `requested` and `used`; unreadable stored credentials use kind `AUTH_FAILED` and code `CREDENTIALS_UNREADABLE`; `CREDENTIAL_EXCHANGE_FAILED` carries params `reason` (`SHOP_NOT_PERMITTED` or `UNKNOWN`); `SCOPE_MISSING` carries params `missing` (array of capability identifiers). `params` values MUST be strings, numbers or arrays of strings, and MUST NOT contain response text, URLs, tokens or error messages. There MUST be at most one `SCOPE_MISSING` problem, whose `missing` is the union of the computed diff and the capabilities implied by a `SCOPE_MISSING` gateway failure on `listLocations` (`locations`).

#### Scenario: Scope problem

- GIVEN granted scopes lacking `write_files`
- WHEN a store is verified
- THEN `problems` has one entry with kind `SCOPE_MISSING`, code `SCOPE_MISSING` and params `missing` equal to `write_files`

#### Scenario: Locations denied by Shopify

- GIVEN granted scopes that list all required handles but `listLocations` fails with `SCOPE_MISSING`
- WHEN a store is verified
- THEN there is one `SCOPE_MISSING` problem with `missing` equal to `locations`, and `shop` and `scopes.granted` are still returned

#### Scenario: Exchange failure params

- GIVEN a `client_credentials` store whose exchange fails with `shop_not_permitted`
- WHEN a store is verified
- THEN the problem has kind `CREDENTIAL_EXCHANGE_FAILED` and params `reason` equal to `SHOP_NOT_PERMITTED`, with no response text

#### Scenario: Unreadable credentials

- GIVEN a store whose envelope cannot be decrypted
- WHEN a store is verified
- THEN no outbound call is made and `problems` has one entry with kind `AUTH_FAILED` and code `CREDENTIALS_UNREADABLE`

### Requirement: Failure handling across the three calls

The use case MUST stop at the first gateway failure, except that a `SCOPE_MISSING` failure of `listLocations` MUST NOT stop it (it is the last call). On a stop, results already obtained (`shop`, `scopes.granted`) MUST still be returned and later parts MUST be empty (`shop` null, `granted` empty, `locations` empty, `missing` equal to the full required list when scopes were not read). The use case MUST NOT throw for gateway failures; it MUST return `ok` false with the problem.

#### Scenario: Auth failure on first call

- GIVEN `AUTH_FAILED` on `getShopInfo`
- WHEN a store is verified
- THEN only one gateway call is made, `shop` is null and `problems` has one `AUTH_FAILED` entry

#### Scenario: Failure on second call

- GIVEN `getShopInfo` succeeds and `getGrantedScopes` fails with `SERVER_ERROR` after retries
- WHEN a store is verified
- THEN `shop` is returned, `listLocations` is not called and `problems` has one `SERVER_ERROR` entry

#### Scenario: Every kind is returned not thrown

- GIVEN each gateway error kind injected into the simulator
- WHEN a store is verified
- THEN the use case returns a result with `ok` false and does not throw

### Requirement: Version mismatch is a problem

When any read result has `apiVersionUsed` that is not null and differs from the requested version, the result MUST contain a problem with kind `VERSION_UNSUPPORTED`, code `API_VERSION_MISMATCH` and params `requested` and `used`, and `apiVersion.used` MUST hold the used value. A null `apiVersionUsed` MUST NOT create a problem and yields `apiVersion.used` null. ASSUMPTION: a fall-forward leaves the data usable but untrusted for the requested version, so the result is not `ok`.

#### Scenario: Fall-forward reported

- GIVEN requested `2026-10` and a response header `2027-01`
- WHEN a store is verified
- THEN `apiVersion.used` is `2027-01` and a problem with code `API_VERSION_MISMATCH` is present

#### Scenario: Matching header

- GIVEN header `2026-10`
- WHEN a store is verified
- THEN no version problem exists

#### Scenario: Missing header

- GIVEN no version header
- WHEN a store is verified
- THEN `apiVersion.used` is null and no version problem exists

### Requirement: Status mapping

After verification the store `status` MUST be set from the problems, with this precedence: `AUTH_FAILED` if any problem has kind `AUTH_FAILED` or `CREDENTIAL_EXCHANGE_FAILED`; else `SCOPE_MISSING` if any problem has kind `SCOPE_MISSING`; else `UNAVAILABLE` if any other problem exists (`SHOP_UNAVAILABLE`, `STORE_NOT_FOUND`, `THROTTLED`, `QUERY_TOO_COSTLY`, `SERVER_ERROR`, `VERSION_UNSUPPORTED`, `NETWORK`, `TIMEOUT`, `INVALID_RESPONSE`, `GRAPHQL_ERROR`); else `CONNECTED`. `ok` and `status` MUST agree: `CONNECTED` if and only if `ok`.

#### Scenario: Connected

- GIVEN a result without problems
- WHEN the status is mapped
- THEN it is `CONNECTED`

#### Scenario: Auth family

- GIVEN problems of kind `AUTH_FAILED` and, separately, `CREDENTIAL_EXCHANGE_FAILED`
- WHEN each is mapped
- THEN both give `AUTH_FAILED`

#### Scenario: Scope over unavailable

- GIVEN problems `SCOPE_MISSING` and `API_VERSION_MISMATCH` together
- WHEN the status is mapped
- THEN it is `SCOPE_MISSING`

#### Scenario: Unavailable family

- GIVEN a single problem of each of kinds `SHOP_UNAVAILABLE`, `STORE_NOT_FOUND`, `THROTTLED`, `QUERY_TOO_COSTLY`, `SERVER_ERROR`, `NETWORK`, `TIMEOUT`, `INVALID_RESPONSE`, `GRAPHQL_ERROR`
- WHEN each is mapped
- THEN every one gives `UNAVAILABLE`

### Requirement: Snapshot persistence

Verification MUST persist, in one update: `status`, `lastVerifiedAt` equal to `checkedAt`, `shopifyShopId` (the shop id when obtained, otherwise unchanged), `apiVersion` (the used version when not null, otherwise the requested version), and `lastVerification` as a JSON document stored as TEXT. The snapshot MUST contain the verification fields except `locations`, replaced by `locationCount` (integer). The snapshot MUST NOT contain any location name or id, any credential, or any raw Shopify text. A failed verification MUST also be persisted. Replacing credentials MUST clear it.

#### Scenario: Snapshot content

- GIVEN a healthy verification with 2 locations
- WHEN it is persisted and the store is read
- THEN `lastVerification.locationCount` is 2 and no location name appears in the stored text

#### Scenario: Failure persisted

- GIVEN a verification with `AUTH_FAILED`
- WHEN it is persisted
- THEN `status` is `AUTH_FAILED`, `lastVerifiedAt` is set and `shopifyShopId` is unchanged

#### Scenario: Version recorded

- GIVEN a fall-forward to `2027-01`
- WHEN it is persisted
- THEN the store `apiVersion` is `2027-01`

#### Scenario: Stored as text

- GIVEN a persisted snapshot
- WHEN the column type and value are inspected
- THEN the column is TEXT and the value parses as JSON

### Requirement: Disclosure that nothing was verified against a real store

The README and the final report of this change MUST state that no behaviour in S2 was verified against a real Shopify store: that classification of throttling, access-denied, bad-token, version fall-forward and client-credentials errors, granted scope strings, plan values, `locations` limits and rename redirects rest on documentation and hand-authored fixtures, and that the live smoke test is planned for a later slice (S7 by default). The README verification-status section MUST be updated in the same change.

#### Scenario: README statement

- GIVEN the README after the change
- WHEN its verification-status section is read
- THEN it states that nothing was verified against a real store and lists the unverified items

#### Scenario: Fixture tags consistent

- GIVEN the statement in the README
- WHEN fixture provenance tags are listed
- THEN none is `recorded`
