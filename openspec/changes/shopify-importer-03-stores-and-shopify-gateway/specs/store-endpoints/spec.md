# Delta for Store Endpoints

New capability. HTTP routes under the global prefix `api` for the store registry and verification. All bodies are JSON. The existing local request guard (Host on every method, Origin and Sec-Fetch-Site on non-safe methods) is unchanged and already covers these routes. Route paths are written here without a leading slash.

## ADDED Requirements

### Requirement: Routes and success statuses

The API MUST expose exactly these store routes with these success responses: `POST api/stores` returns 201 with the store summary; `GET api/stores` returns 200 with `{ stores: [summary, ...] }` ordered by `createdAt` ascending then `id`; `GET api/stores/{id}` returns 200 with the summary; `POST api/stores/{id}/verify` (no body) returns 200 with a `StoreVerification`, also when `ok` is false; `PUT api/stores/{id}/credentials` returns 200 with the updated summary; `DELETE api/stores/{id}` returns 204 with no body. A verification whose Shopify calls fail MUST NOT produce a 4xx or 5xx status.

#### Scenario: Create then list

- GIVEN no stores
- WHEN `POST api/stores` succeeds and then `GET api/stores` is called
- THEN the first returns 201 with a summary and the second returns 200 with a list of one

#### Scenario: Verify failure is a 200

- GIVEN a store whose credentials the simulator rejects
- WHEN `POST api/stores/{id}/verify` is called
- THEN the response is 200 with `ok` false and a problem of kind `AUTH_FAILED`

#### Scenario: Delete

- GIVEN an existing store
- WHEN `DELETE api/stores/{id}` is called
- THEN the response is 204 with an empty body and a following `GET api/stores/{id}` returns 404

#### Scenario: Replace credentials

- GIVEN a connected store
- WHEN `PUT api/stores/{id}/credentials` is called with a valid payload
- THEN the response is 200 and the summary has `status` `UNVERIFIED`

### Requirement: Create request validation

The body of `POST api/stores` MUST be `{ displayName, domain, credentials }` with no other field, where `credentials` is one of the two credential payloads. The body of `PUT api/stores/{id}/credentials` MUST be `{ credentials }` with no other field. Validation MUST run before any persistence or outbound call and MUST respond 400, using this precedence: malformed JSON, unknown fields, wrong types or an invalid `displayName` give `STORE_REQUEST_INVALID`; then an invalid domain gives `STORE_DOMAIN_INVALID`; then invalid credentials give `STORE_CREDENTIALS_INVALID`. A duplicate canonical domain MUST respond 409 with `STORE_ALREADY_EXISTS`. The module MUST read the JSON body itself, with a limit of 16 KB, and MUST answer a body that is malformed, not JSON, not UTF-8 or over the limit with `STORE_REQUEST_INVALID` and never with the framework's own parser message (the framework parser's errors do not reach the module's filter and quote the parser's complaint).

#### Scenario: Invalid domain

- GIVEN a body whose `domain` is `myshopify.com.evil.example`
- WHEN it is posted
- THEN the response is 400 with `STORE_DOMAIN_INVALID` and no row exists

#### Scenario: Invalid credentials

- GIVEN a body whose `accessToken` has 7 characters
- WHEN it is posted
- THEN the response is 400 with `STORE_CREDENTIALS_INVALID`

#### Scenario: Request shape errors

- GIVEN malformed JSON, an extra field, and a 81 character `displayName`
- WHEN each is posted
- THEN each response is 400 with `STORE_REQUEST_INVALID`

#### Scenario: Oversize or non-JSON body

- GIVEN a body over 16 KB, or a body sent as `text/plain`
- WHEN it is posted
- THEN the response is 400 with `STORE_REQUEST_INVALID` and no parser message

#### Scenario: Precedence

- GIVEN a body with both an invalid domain and invalid credentials
- WHEN it is posted
- THEN the code is `STORE_DOMAIN_INVALID`

#### Scenario: Duplicate

- GIVEN an existing store for `demo.myshopify.com`
- WHEN another is posted with the domain `demo`
- THEN the response is 409 with `STORE_ALREADY_EXISTS`

### Requirement: Unknown stores

Any route with an `{id}` MUST respond 404 with `STORE_NOT_FOUND` when no store has that id, including when the id is not a well-formed UUID, and MUST NOT call the gateway. A well-formed but unknown id and a malformed id MUST produce identical responses.

#### Scenario: Unknown id

- GIVEN no store with a given UUID
- WHEN each of the four id routes is called
- THEN each returns 404 with `STORE_NOT_FOUND`

#### Scenario: Malformed id

- GIVEN the id `not-a-uuid`
- WHEN `GET api/stores/not-a-uuid` is called
- THEN the response is identical to the unknown UUID case

### Requirement: Origin guard on every write route

Every non-GET store route (`POST api/stores`, `POST api/stores/{id}/verify`, `PUT api/stores/{id}/credentials`, `DELETE api/stores/{id}`) MUST be subject to the local origin guard: a request with a disallowed `Origin`, or with no `Origin` and a `Sec-Fetch-Site` of `cross-site` or `same-site`, MUST receive 403 with `ORIGIN_NOT_ALLOWED`, and the handler, the repository and the gateway MUST NOT run.

#### Scenario: Foreign origin on each write route

- GIVEN `Origin: https://evil.example`
- WHEN each of the four write routes is called
- THEN each returns 403 with `ORIGIN_NOT_ALLOWED`, the handler spy has zero calls and the store table is unchanged

#### Scenario: Cross-site without Origin

- GIVEN no `Origin` and `Sec-Fetch-Site: cross-site` on `POST api/stores/{id}/verify`
- WHEN it is sent
- THEN the response is 403 and the gateway has zero calls

#### Scenario: Allowed origin

- GIVEN an allow-listed `Origin`
- WHEN a write route is called with a valid request
- THEN it is processed

### Requirement: GET routes are side-effect free and secret-free

`GET api/stores` and `GET api/stores/{id}` MUST NOT call Shopify, MUST NOT decrypt credentials, MUST NOT change any row (including `updatedAt`), and MUST NOT return any secret. A GET with a foreign `Origin` MAY be answered (the Origin rule does not apply to GET) but the response MUST contain no secret. The Host rule MUST still apply: a disallowed Host MUST receive 403 `HOST_NOT_ALLOWED`.

#### Scenario: No side effect

- GIVEN a store, a gateway spy and a `SecretBox` spy
- WHEN both GET routes are called
- THEN the spies have zero calls and the row is byte-identical

#### Scenario: Foreign origin on GET

- GIVEN `Origin: https://evil.example`
- WHEN `GET api/stores` is called
- THEN the response is 200 and contains no canary or envelope

#### Scenario: Disallowed host

- GIVEN a `Host` that is not allow-listed
- WHEN `GET api/stores` is called
- THEN the response is 403 with `HOST_NOT_ALLOWED`

### Requirement: No-store caching

Every response of the store routes, including errors and 204, MUST carry `Cache-Control: no-store`.

#### Scenario: Success and error

- GIVEN a successful create and a 404 read
- WHEN their headers are inspected
- THEN both have `Cache-Control: no-store`

#### Scenario: Delete

- GIVEN a 204 delete response
- WHEN its headers are inspected
- THEN it has `Cache-Control: no-store`

### Requirement: New ApiError codes and fixed messages

The contracts `ApiError.code` enum MUST be extended with `STORE_NOT_FOUND`, `STORE_DOMAIN_INVALID`, `STORE_ALREADY_EXISTS`, `STORE_CREDENTIALS_INVALID` and `STORE_REQUEST_INVALID`, keeping all existing codes. The messages MUST be fixed strings that never echo the request: `STORE_NOT_FOUND` is `Store not found.`; `STORE_DOMAIN_INVALID` is `The shop domain is not valid. Use the myshopify.com domain of the store.`; `STORE_ALREADY_EXISTS` is `A store with this domain already exists.`; `STORE_CREDENTIALS_INVALID` is `The credentials are not valid.`; `STORE_REQUEST_INVALID` is `The request is not valid.`. Statuses are 404, 400, 409, 400 and 400 respectively. The enumeration test in the contracts package MUST list the new codes. The web package has no enumeration test of its own and is not changed.

#### Scenario: Enum content

- GIVEN the contracts `ApiError` schema
- WHEN each new code is parsed
- THEN all five parse, and `HOST_NOT_ALLOWED` and `ORIGIN_NOT_ALLOWED` still parse

#### Scenario: No echo

- GIVEN a request with the domain `https://canary.example` and a canary `accessToken`
- WHEN it is rejected
- THEN the response body contains neither canary nor the submitted domain

#### Scenario: Fixed text

- GIVEN two different invalid domains
- WHEN both are rejected
- THEN the two response bodies are identical

### Requirement: No secret in logs, errors, responses or storage

For every flow (create, verify with success and with each gateway failure kind, replace credentials, delete) with distinct canary values for a static token, a client secret, an exchanged token, a string shaped like `shpat_` followed by hex, and a `Bearer` string, none of the canaries MUST appear in: the captured logger output, every `ApiError` or response body, the `message`, properties and full `cause` chain of every thrown error, or the database file as plaintext. Request bodies MUST NOT be logged by the application, the framework or the persistence layer. Log field names MUST NOT contain the redaction substrings (`authorization`, `cookie`, `token`, `secret`, `password`, `signature`, `credential`); the fields `authKind` and `expiresAt` are used instead.

#### Scenario: Canary sweep

- GIVEN the canary values seeded through all flows
- WHEN logs, response bodies, error chains and the database are scanned
- THEN no canary is found

#### Scenario: Body not logged

- GIVEN a create request with canary credentials and a logger sink
- WHEN the request is handled and when it is rejected by validation
- THEN no log line contains any part of the body

#### Scenario: Field names

- GIVEN the log calls of the stores module
- WHEN their field names are checked against the redaction substrings
- THEN none matches, so `authKind` and `expiresAt` are printed unredacted

### Requirement: Local API authentication limitation is documented

The README limitations MUST state that the local API has no authentication, so any process on the machine can create, replace or delete store credentials, and that only the Host and Origin guards apply. This residual risk is not solved in this change.

#### Scenario: README text

- GIVEN the README after the change
- WHEN its limitations section is read
- THEN it states the lack of local API authentication and its consequence for credentials

#### Scenario: Redactor growth noted

- GIVEN the same section
- WHEN it is read
- THEN it notes that the set of redacted secret values grows during the life of the process
