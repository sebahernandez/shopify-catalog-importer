# Delta for Credential Provider

New capability. A credential provider hands the gateway a valid Admin API access token for one store. Behaviours marked ASSUMPTION rest on documentation that does not state them (research items deferred to the live smoke test); fixtures for them carry the provenance tag `hand-authored-from-documentation`.

## ADDED Requirements

### Requirement: Two credential kinds

The system MUST support exactly two credential kinds. `static_token` carries one secret, `accessToken`. `client_credentials` carries `clientId` and `clientSecret`. Every credential string MUST be trimmed of surrounding whitespace and then be 1 to 512 characters; `accessToken` and `clientSecret` MUST be at least 8 characters so that log redaction can cover them. Any other kind, a missing field, or an extra field MUST be rejected.

#### Scenario: Static token accepted

- GIVEN `{ kind: static_token, accessToken }` with a 38 character token
- WHEN it is validated
- THEN it is accepted

#### Scenario: Client credentials accepted

- GIVEN `{ kind: client_credentials, clientId, clientSecret }` with valid strings
- WHEN it is validated
- THEN it is accepted

#### Scenario: Invalid payloads

- GIVEN payloads with an unknown kind, a missing `clientSecret`, an `accessToken` of 7 characters, a value of 513 characters, or an extra field
- WHEN each is validated
- THEN each is rejected as an invalid credentials payload

#### Scenario: Trimmed

- GIVEN an `accessToken` with a trailing newline
- WHEN it is validated
- THEN the stored and used value has no surrounding whitespace

### Requirement: Encrypted envelope bound to the store

The credentials of a store MUST be stored as one `SecretBox` envelope of a JSON payload (`{ accessToken }` or `{ clientId, clientSecret }`), encrypted with the context string `store:<id>:credentials`, where `<id>` is the store id in lower case. `authKind` MUST be stored beside the envelope, not inside it. Decrypting an envelope with any other context (another store id, or another field name) MUST fail with `DECRYPT_FAILED`, and an envelope whose payload shape does not match `authKind` MUST be treated as unreadable.

#### Scenario: Round trip under own context

- GIVEN a store created with a credentials payload
- WHEN its envelope is decrypted with context `store:<id>:credentials`
- THEN the original payload is returned

#### Scenario: Different context

- GIVEN the envelope of store A
- WHEN it is decrypted with the context of store B
- THEN decryption fails with `DECRYPT_FAILED` and returns no plaintext

#### Scenario: Swapped envelopes

- GIVEN the envelopes of two stores swapped between their rows
- WHEN either store is asked for a token
- THEN the credentials are reported unreadable and no outbound call is made

#### Scenario: Envelope is not plaintext

- GIVEN a store created with canary secrets
- WHEN the stored column is read
- THEN it starts with `sb1.` and contains no canary substring

### Requirement: Client-credentials exchange request

For `client_credentials`, the provider MUST obtain a token by one `POST` to `https://<canonical domain>/admin/oauth/access_token` with the content type `application/x-www-form-urlencoded` and a body containing `grant_type=client_credentials`, `client_id` and `client_secret`. The request MUST use the same fixed URL construction, redirect refusal, 15 second timeout, 2 MB response cap and injected `fetch` as the gateway client. The response MUST provide `access_token` (non-empty string) and `expires_in` (positive integer seconds). Fields other than `access_token`, `scope` and `expires_in` MUST be ignored.

#### Scenario: Request shape

- GIVEN a store of kind `client_credentials`
- WHEN a token is requested
- THEN exactly one form POST goes to the token URL of the canonical domain with the three form fields and no `X-Shopify-Access-Token` header

#### Scenario: Response parsed

- GIVEN a response with `access_token`, `scope` and `expires_in` of 86399
- WHEN it is parsed
- THEN the token is returned together with an expiry 86399 seconds after the injected clock time

#### Scenario: Missing token field

- GIVEN a 200 response without `access_token`
- WHEN it is parsed
- THEN the result is `CREDENTIAL_EXCHANGE_FAILED`

#### Scenario: Static token needs no exchange

- GIVEN a store of kind `static_token`
- WHEN a token is requested
- THEN the decrypted `accessToken` is returned and no request is made

### Requirement: Token cache and refresh margin

The provider MUST cache the exchanged token in memory per store, and MUST reuse it while the injected clock time is earlier than expiry minus a margin of 60 seconds. At or after that instant it MUST exchange again before returning a token.

#### Scenario: Reuse inside the window

- GIVEN a token with `expires_in` 86399 obtained at time T
- WHEN a token is requested at T plus 86339 seconds
- THEN the cached token is returned and no exchange runs

#### Scenario: Refresh at the margin

- GIVEN the same token
- WHEN a token is requested at T plus 86340 seconds
- THEN a new exchange runs and its token is returned

#### Scenario: Stores are independent

- GIVEN cached tokens for stores A and B
- WHEN store A's token is refreshed
- THEN store B's cached token is unchanged

### Requirement: Single-flight exchange

When several callers need a token for the same store while an exchange is in flight, the provider MUST share that one exchange: it MUST send exactly one request and every waiting caller MUST receive its result, success or failure. A failed exchange MUST NOT be cached; the next call MUST start a new exchange.

#### Scenario: Concurrent callers

- GIVEN five concurrent calls with an empty cache
- WHEN they run
- THEN exactly one exchange request is sent and all five receive the same token

#### Scenario: Shared failure

- GIVEN three concurrent calls and an exchange that fails
- WHEN they run
- THEN one request is sent and all three receive the same failure kind

#### Scenario: Retry after failure

- GIVEN a failed exchange
- WHEN a later call is made
- THEN a new exchange request is sent

### Requirement: Forced refresh on authentication failure

When a gateway call with a `client_credentials` token fails with `AUTH_FAILED`, the provider MUST discard the cached token, perform one forced exchange, and the call MUST be retried once with the new token. This happens at most once per gateway operation, in addition to the retry policy, and a second `AUTH_FAILED` MUST be returned to the caller. Failures of any other kind MUST NOT cause a forced refresh. For `static_token`, `AUTH_FAILED` MUST be returned without any refresh or retry.

#### Scenario: Refresh recovers

- GIVEN a cached token that Shopify rejects with 401 and a valid new exchange
- WHEN a read runs
- THEN one forced exchange and one retry occur and the read succeeds

#### Scenario: Second failure surfaces

- GIVEN a rejected cached token and a rejected new token
- WHEN a read runs
- THEN exactly two Admin API requests and one extra exchange occur and the result is `AUTH_FAILED`

#### Scenario: Other kinds do not refresh

- GIVEN a read that fails with `SCOPE_MISSING`, `THROTTLED` or `SERVER_ERROR`
- WHEN the failure is handled
- THEN no forced exchange runs

#### Scenario: Static token

- GIVEN a store of kind `static_token` and a 401 response
- WHEN a read runs
- THEN the result is `AUTH_FAILED` after one request

### Requirement: Exchange failures are classified from opaque bodies

The token endpoint error body MUST be treated as opaque text and classified only by status and message text, never echoed. ASSUMPTION: Shopify's statuses and bodies for these errors are undocumented. A network failure MUST map to `NETWORK`, a timeout to `TIMEOUT`, a 5xx status to `SERVER_ERROR`, a 429 status to `THROTTLED`, and any other non-2xx status or unparseable body to `CREDENTIAL_EXCHANGE_FAILED`. A body whose text contains `shop_not_permitted` MUST set the failure reason to `SHOP_NOT_PERMITTED`; every other `CREDENTIAL_EXCHANGE_FAILED` MUST have the reason `UNKNOWN`. The error message MUST be a fixed string and MUST NOT contain the body, the `client_id` or the `client_secret`.

#### Scenario: Shop not permitted

- GIVEN a 4xx response whose text includes `Oauth error shop_not_permitted: Client credentials cannot be performed on this shop.`
- WHEN it is classified
- THEN the kind is `CREDENTIAL_EXCHANGE_FAILED` with reason `SHOP_NOT_PERMITTED`

#### Scenario: Unknown rejection

- GIVEN a 401 response with an unrecognised body
- WHEN it is classified
- THEN the kind is `CREDENTIAL_EXCHANGE_FAILED` with reason `UNKNOWN`

#### Scenario: Transport and server failures

- GIVEN a connection error, an abort, a 503 and a 429 at the token endpoint
- WHEN each is classified
- THEN the kinds are `NETWORK`, `TIMEOUT`, `SERVER_ERROR` and `THROTTLED`

#### Scenario: No echo

- GIVEN an error body that contains the canary `client_secret`
- WHEN the failure is raised
- THEN the error message, properties and cause chain contain no canary and no body text

### Requirement: Token cache is memory only and registered for redaction

Cached tokens MUST live only in process memory: never in the database, a file or a response. Every decrypted `accessToken`, `clientSecret` and exchanged token MUST be registered with the logging redactor before it is used in a request. Removing a store or replacing its credentials MUST drop its cached token. The redactor registry only grows within a process; this MUST be noted in the README limitations.

#### Scenario: Redactor registration

- GIVEN a store with a canary `clientSecret` whose exchange returns a canary token
- WHEN a verification runs and the logger is asked to print both values
- THEN both appear as `[REDACTED]`

#### Scenario: Cache dropped on replace

- GIVEN a cached token for a store
- WHEN its credentials are replaced
- THEN the next token request performs a new exchange or decryption

#### Scenario: Cache dropped on delete

- GIVEN a cached token for a store
- WHEN the store is deleted
- THEN no cached token for it remains
