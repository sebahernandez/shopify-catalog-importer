# Delta for Shopify Gateway

New capability. The gateway is the only code that talks to the Shopify Admin GraphQL API. S2 offers three reads and no writes. Items marked ASSUMPTION rest on documentation that does not state them (research items Q-R1 to Q-R5 and Q-R8 deferred to the live smoke test). Fixtures that encode an assumption carry the provenance tag `hand-authored-from-documentation`; no fixture is `recorded` in S2. Nothing here was verified against a real store.

## ADDED Requirements

### Requirement: Read-only port with three operations

The `ShopifyGateway` port MUST expose exactly three operations in S2: `getShopInfo`, `getGrantedScopes` and `listLocations`. Each MUST take a store connection (validated canonical domain, API version, credential provider) so the gateway holds no per-store state apart from throttle tracking. The port MUST NOT expose any mutation. Each successful result MUST carry `apiVersionUsed` (the value of the response header `X-Shopify-API-Version`, or null when absent).

#### Scenario: Port surface

- GIVEN the port definition
- WHEN its operations are listed
- THEN they are `getShopInfo`, `getGrantedScopes` and `listLocations` only

#### Scenario: Many stores at once

- GIVEN two store connections with different domains
- WHEN reads run concurrently
- THEN each request is sent to its own domain with its own token

### Requirement: Shop info and granted scopes results

`getShopInfo` MUST return `id`, `name`, `myshopifyDomain`, `currencyCode`, `planName` (from the plan's `publicDisplayName`), `shopifyPlus` and `partnerDevelopment`. It MUST NOT use the deprecated plan `displayName`. `getGrantedScopes` MUST return the scope handles from `currentAppInstallation.accessScopes` as an array of unique strings in the order received, taken verbatim.

#### Scenario: Shop info mapping

- GIVEN a response with a shop, a currency and a plan whose `publicDisplayName` is `Basic`
- WHEN `getShopInfo` runs
- THEN `planName` is `Basic` and the other fields are returned as named

#### Scenario: Granted scopes

- GIVEN a response listing handles `write_products`, `read_locations` and `write_products`
- WHEN `getGrantedScopes` runs
- THEN the result is `write_products`, `read_locations`

#### Scenario: Missing fields

- GIVEN a 200 response in which `shop.currencyCode` is absent
- WHEN `getShopInfo` runs
- THEN the result is `INVALID_RESPONSE`

### Requirement: Locations are capped at 250

`listLocations` MUST return active locations only (`id`, `name`, `isActive`, `fulfillsOnlineOrders`), ordered by name ascending and then by `id`, and MUST return at most 250 of them with a boolean `truncated` that is true if and only if more than 250 exist. The page size per request is a design detail; the cap and the flag are not. ASSUMPTION: the maximum page size and the default page size of the `locations` query are undocumented.

#### Scenario: Under the cap

- GIVEN a shop with 3 active locations
- WHEN `listLocations` runs
- THEN 3 locations are returned and `truncated` is false

#### Scenario: Exactly 250

- GIVEN a shop with 250 locations
- WHEN `listLocations` runs
- THEN 250 are returned and `truncated` is false

#### Scenario: Over the cap

- GIVEN a shop with 251 locations
- WHEN `listLocations` runs
- THEN 250 are returned and `truncated` is true

#### Scenario: Inactive excluded

- GIVEN a shop with one inactive and two active locations
- WHEN `listLocations` runs
- THEN only the two active ones are returned

### Requirement: Simulated gateway with injectable faults

`SimulatedShopifyGateway` MUST implement the port in memory without network, timers or randomness. Shops are keyed by canonical domain with name, currency, plan, granted scopes and locations; an unknown domain MUST fail with `STORE_NOT_FOUND`. Faults MUST be injectable per operation and per call number, for the kinds `AUTH_FAILED`, `SCOPE_MISSING`, `THROTTLED` (with `retryAfterMs`), `NETWORK`, `TIMEOUT`, `SERVER_ERROR`, `INVALID_RESPONSE` and `VERSION_UNSUPPORTED`. A `VERSION_UNSUPPORTED` fault MUST make the operation succeed with an `apiVersionUsed` different from the requested version (fall-forward); every other fault MUST throw a `ShopifyGatewayError` of that kind. Output ordering MUST be deterministic.

#### Scenario: Fault on second call only

- GIVEN a `THROTTLED` fault set for call number 2 of `getShopInfo`
- WHEN the operation is called three times
- THEN calls 1 and 3 succeed and call 2 throws `THROTTLED`

#### Scenario: Unknown shop

- GIVEN a simulator without the domain `ghost.myshopify.com`
- WHEN any operation targets it
- THEN it throws `STORE_NOT_FOUND`

#### Scenario: Fall-forward fault

- GIVEN a `VERSION_UNSUPPORTED` fault and a requested version `2026-10`
- WHEN `getShopInfo` runs
- THEN it succeeds and `apiVersionUsed` differs from `2026-10`

### Requirement: Shared contract suite

One parameterized suite MUST run against both the simulator and the HTTP adapter driven by a scripted `fetch` with fixture responses. Both MUST produce the same results and the same error kinds for at least: a healthy shop, a missing scope, an authentication failure, a throttled response followed by success, a server error, a network failure, a timeout, and an invalid response. Every fixture MUST carry a provenance tag, and every S2 fixture MUST be tagged `hand-authored-from-documentation`.

#### Scenario: Same result

- GIVEN the healthy-shop case
- WHEN the suite runs on both implementations
- THEN the returned shop info, scopes and locations are equal

#### Scenario: Same error kind

- GIVEN each failure case
- WHEN the suite runs on both implementations
- THEN the thrown `ShopifyGatewayError.kind` is equal

#### Scenario: Fixture provenance

- GIVEN the fixture files
- WHEN their metadata is read
- THEN each has a provenance tag and none is tagged `recorded`

### Requirement: Typed gateway error without raw data

Gateway failures MUST be thrown as `ShopifyGatewayError` with `kind`, `retryable` (boolean), optional `retryAfterMs`, optional `reason` (credential exchange only) and a fixed message per kind. `kind` MUST be one of `AUTH_FAILED`, `SCOPE_MISSING`, `SHOP_UNAVAILABLE`, `STORE_NOT_FOUND`, `THROTTLED`, `QUERY_TOO_COSTLY`, `SERVER_ERROR`, `VERSION_UNSUPPORTED`, `NETWORK`, `TIMEOUT`, `INVALID_RESPONSE`, `GRAPHQL_ERROR`, `CREDENTIAL_EXCHANGE_FAILED`. `retryable` MUST be true for `THROTTLED`, `SERVER_ERROR`, `NETWORK` and `TIMEOUT` only. An error MUST NOT carry the response body, headers, request URL, token, original error or `cause`. No raw error from `fetch`, the parser or the provider may escape the gateway.

#### Scenario: Retryable flags

- GIVEN one error of each kind
- WHEN `retryable` is read
- THEN it is true for exactly the four kinds above

#### Scenario: No cause chain

- GIVEN a failure whose underlying error carries the URL and a canary token in its cause
- WHEN the gateway throws
- THEN the thrown error has no `cause` and its serialized form contains neither the URL path nor the canary

#### Scenario: Fixed messages

- GIVEN two errors of the same kind from different response bodies
- WHEN their messages are compared
- THEN they are identical

### Requirement: Classification by HTTP status

The HTTP adapter MUST classify non-2xx statuses as: 401 to `AUTH_FAILED`; 402, 403 and 423 to `SHOP_UNAVAILABLE`; 404 to `STORE_NOT_FOUND`; 429 to `THROTTLED`; any 5xx to `SERVER_ERROR`. Any other non-2xx status MUST map to `GRAPHQL_ERROR` when the body is JSON with a non-empty `errors` array, and to `INVALID_RESPONSE` otherwise. A `Retry-After` header, when present and a non-negative integer of seconds, MUST become `retryAfterMs` on `THROTTLED`; ASSUMPTION: Shopify does not document `Retry-After` for GraphQL.

#### Scenario: Status table

- GIVEN scripted responses with statuses 401, 402, 403, 404, 423, 429 and 503
- WHEN each is classified
- THEN the kinds are `AUTH_FAILED`, `SHOP_UNAVAILABLE`, `SHOP_UNAVAILABLE`, `STORE_NOT_FOUND`, `SHOP_UNAVAILABLE`, `THROTTLED` and `SERVER_ERROR`

#### Scenario: Unlisted status with GraphQL errors

- GIVEN a 400 response with a JSON body `{ "errors": [ { "message": "x" } ] }`
- WHEN it is classified
- THEN the kind is `GRAPHQL_ERROR`

#### Scenario: Unlisted status without errors

- GIVEN a 418 response with an HTML body
- WHEN it is classified
- THEN the kind is `INVALID_RESPONSE`

#### Scenario: Retry-After

- GIVEN a 429 response with `Retry-After: 2`
- WHEN it is classified
- THEN `THROTTLED` carries `retryAfterMs` 2000

### Requirement: Classification of errors inside a 200 response

For a 2xx response whose JSON body has a non-empty `errors` array, the adapter MUST use no data from the body and MUST classify by the first matching rule in this order: any entry with `extensions.code` `THROTTLED` gives `THROTTLED` (Shopify returns throttling as HTTP 200); any entry whose message contains `Invalid API key or access token` gives `AUTH_FAILED`; any entry with `extensions.code` `ACCESS_DENIED` gives `SCOPE_MISSING`; `SHOP_INACTIVE` gives `SHOP_UNAVAILABLE`; `MAX_COST_EXCEEDED` gives `QUERY_TOO_COSTLY`; `INTERNAL_SERVER_ERROR` gives `SERVER_ERROR`; anything else gives `GRAPHQL_ERROR`. ASSUMPTION: the exact JSON bodies of THROTTLED and ACCESS_DENIED responses are undocumented, so the adapter reads only `extensions.code` and `message`, and tolerates the absence of `requiredAccess` and `path`.

#### Scenario: Throttled in 200

- GIVEN an HTTP 200 body with an error whose `extensions.code` is `THROTTLED`
- WHEN it is classified
- THEN the kind is `THROTTLED`

#### Scenario: Missing scope in 200

- GIVEN an HTTP 200 body with an error whose `extensions.code` is `ACCESS_DENIED` and no `requiredAccess`
- WHEN it is classified
- THEN the kind is `SCOPE_MISSING`

#### Scenario: Cost exceeded

- GIVEN an error with code `MAX_COST_EXCEEDED` and message `Query cost is 2003, which exceeds the single query max cost limit (1000)`
- WHEN it is classified
- THEN the kind is `QUERY_TOO_COSTLY`

#### Scenario: Precedence

- GIVEN a body with both a `THROTTLED` and an `ACCESS_DENIED` entry
- WHEN it is classified
- THEN the kind is `THROTTLED`

#### Scenario: Invalid key message

- GIVEN a body whose only error message is `Invalid API key or access token (unrecognized login or wrong password)`
- WHEN it is classified
- THEN the kind is `AUTH_FAILED`

### Requirement: Unknown shapes never escape as raw errors

A response that is not valid JSON, is not an object, has neither `data` nor `errors`, is an empty body, or whose `data` does not match the expected schema MUST fail with `INVALID_RESPONSE`. Errors entries with unrecognised codes MUST fail with `GRAPHQL_ERROR`. The failure MUST NOT contain any part of the body.

#### Scenario: HTML maintenance page

- GIVEN a 200 response with an HTML body
- WHEN it is parsed
- THEN the kind is `INVALID_RESPONSE`

#### Scenario: Unknown error code

- GIVEN a 200 body with one error with code `SOMETHING_NEW`
- WHEN it is classified
- THEN the kind is `GRAPHQL_ERROR`

#### Scenario: Schema mismatch

- GIVEN a 200 body `{ "data": { "shop": { "id": 5 } } }`
- WHEN `getShopInfo` parses it
- THEN the kind is `INVALID_RESPONSE`

### Requirement: Request construction

Each GraphQL call MUST be one `POST` to `https://<canonical domain>/admin/api/<version>/graphql.json`, where `<version>` is the configured Admin API version, with the headers `Content-Type: application/json`, `Accept: application/json` and `X-Shopify-Access-Token: <token>`, and a JSON body of `query` and `variables`. The token MUST appear only in that header: never in the URL, the body, a log line or an error. The `fetch` function MUST be injected. The three read queries MUST each have a declared estimated cost below 1,000 points.

#### Scenario: Request shape

- GIVEN a store connection and a recorded `fetch`
- WHEN `getShopInfo` runs
- THEN the call is a POST to the URL above with the three headers and a JSON body, and the token appears nowhere else

#### Scenario: Version from configuration

- GIVEN configuration with API version `2026-10`
- WHEN any read runs
- THEN the URL contains `2026-10` and the adapter source contains no version literal

#### Scenario: Injected fetch

- GIVEN a scripted `fetch`
- WHEN reads run
- THEN no socket is opened and the global `fetch` is not called

### Requirement: Transport limits

The adapter MUST abort a request after 15 seconds (`TIMEOUT`), read at most 2 MB (2,097,152 bytes) of response while streaming and fail with `INVALID_RESPONSE` when exceeded without buffering the rest, require a response content type of `application/json` (a charset parameter is allowed) and fail with `INVALID_RESPONSE` otherwise, map a transport failure (DNS, refused connection, TLS, redirect refused) to `NETWORK`, and drop the original error of each failure.

#### Scenario: Timeout

- GIVEN a scripted `fetch` that never resolves and a fake clock
- WHEN 15 seconds pass
- THEN the call fails with `TIMEOUT`

#### Scenario: Oversize body

- GIVEN a response body of 2,097,153 bytes
- WHEN it is read
- THEN the call fails with `INVALID_RESPONSE`

#### Scenario: Body at the limit

- GIVEN a valid JSON response of exactly 2,097,152 bytes
- WHEN it is read
- THEN it is parsed normally

#### Scenario: Wrong content type

- GIVEN a 200 response with the content type `text/html`
- WHEN it is read
- THEN the call fails with `INVALID_RESPONSE`

#### Scenario: Transport errors

- GIVEN a `fetch` that throws an error with cause code `ENOTFOUND` and the URL in its message
- WHEN the call runs
- THEN it fails with `NETWORK` and the thrown error exposes neither the URL nor the cause

### Requirement: API version header check

The adapter MUST read `X-Shopify-API-Version` from every response and return it as `apiVersionUsed`. A value that differs from the requested version signals Shopify's fall-forward to another version; the adapter MUST still return the data and MUST NOT throw. ASSUMPTION: the status and body of a fall-forward response are undocumented. A missing header MUST yield `apiVersionUsed` null and is not an error.

#### Scenario: Header matches

- GIVEN a response header `X-Shopify-API-Version: 2026-10` for a request for `2026-10`
- WHEN the read completes
- THEN `apiVersionUsed` is `2026-10`

#### Scenario: Fall-forward

- GIVEN a response header `2027-01` for a request for `2026-10`
- WHEN the read completes
- THEN the data is returned and `apiVersionUsed` is `2027-01`

#### Scenario: Header absent

- GIVEN a response without that header
- WHEN the read completes
- THEN `apiVersionUsed` is null and no error is raised

### Requirement: Cost tracking and throttle tracker

The adapter MUST read `extensions.cost.throttleStatus` (`maximumAvailable`, `currentlyAvailable`, `restoreRate`) from every response, including error responses, and pass it to a pure `ThrottleTracker` with an injected clock; the tracker MUST NOT assume plan numbers. For a store, `waitTimeFor(estimatedCost)` MUST return 0 when no state is known, otherwise 0 if the projected available points are at least the cost, else the milliseconds to wait, rounded up, where projected points are `min(maximumAvailable, currentlyAvailable + restoreRate * elapsedSeconds)`. A missing or malformed cost block MUST leave the tracker state unchanged. State MUST be kept per store. Before sending, the adapter MUST wait the advised time using an injected sleeper.

#### Scenario: Wait computed

- GIVEN a status of 100 available, restore rate 50 per second, maximum 1000, observed at time T
- WHEN `waitTimeFor(300)` is asked at T
- THEN it returns 4000 ms

#### Scenario: Restored over time

- GIVEN the same observation
- WHEN `waitTimeFor(300)` is asked at T plus 2 seconds
- THEN it returns 2000 ms

#### Scenario: Enough points

- GIVEN the same observation
- WHEN `waitTimeFor(80)` is asked at T
- THEN it returns 0

#### Scenario: Cap at maximum

- GIVEN 900 available, restore rate 100, maximum 1000, observed at T
- WHEN `waitTimeFor(1000)` is asked at T plus 60 seconds
- THEN it returns 0 (projected points are capped at 1000, which is enough)

#### Scenario: Unknown or malformed

- GIVEN a store never observed, and a response with a malformed cost block
- WHEN the tracker is consulted
- THEN it returns 0 and its state is unchanged by the malformed block

#### Scenario: Per store

- GIVEN observations for stores A and B with different values
- WHEN `waitTimeFor` is asked for A
- THEN B's values have no effect

### Requirement: Retry policy for reads

A read declared with `retry: 'safe'` MUST be attempted at most 3 times in total. Between attempts the adapter MUST wait a backoff drawn uniformly between 0 and `1000 * 2^(n-1)` milliseconds after failed attempt n (full jitter, so up to 1000 ms after the first failure and 2000 ms after the second), using an injected random source and sleeper; when the error has `retryAfterMs`, the wait MUST be at least that value. It MUST retry only on `THROTTLED`, `SERVER_ERROR`, `NETWORK` and `TIMEOUT`. After the last failed attempt, the last error MUST be thrown unchanged.

#### Scenario: Succeeds on third attempt

- GIVEN a `THROTTLED` response twice and then a success
- WHEN a safe read runs with random value 0.5
- THEN there are 3 requests, the waits are 500 ms and 1000 ms, and the read succeeds

#### Scenario: Attempts exhausted

- GIVEN `SERVER_ERROR` on every attempt
- WHEN a safe read runs
- THEN exactly 3 requests are sent and the result is `SERVER_ERROR`

#### Scenario: Retry-After honoured

- GIVEN a `THROTTLED` error with `retryAfterMs` 5000 and random value 0
- WHEN the retry is scheduled
- THEN the wait is 5000 ms

#### Scenario: Retried kinds

- GIVEN a first failure of kind `NETWORK`, then `TIMEOUT`, then success
- WHEN a safe read runs
- THEN the read succeeds on attempt 3

### Requirement: Non-retryable kinds and mutations

The adapter MUST NOT retry `AUTH_FAILED` (apart from the single forced credential refresh in the credential provider), `SCOPE_MISSING`, `SHOP_UNAVAILABLE`, `STORE_NOT_FOUND`, `QUERY_TOO_COSTLY`, `VERSION_UNSUPPORTED`, `INVALID_RESPONSE`, `GRAPHQL_ERROR` or `CREDENTIAL_EXCHANGE_FAILED`. The request type MUST make the retry mode explicit as `'safe'` or `'none'`; a request that does not declare it, and every mutation, MUST be treated as `'none'` and attempted exactly once, whatever the error kind.

#### Scenario: No retry on terminal kinds

- GIVEN a response that classifies as `SCOPE_MISSING`, then `QUERY_TOO_COSTLY`, then `SHOP_UNAVAILABLE`
- WHEN a safe read runs against each
- THEN each performs exactly one request

#### Scenario: Retry none

- GIVEN a request declared `retry: 'none'` and a `THROTTLED` response
- WHEN it runs
- THEN exactly one request is sent and the error is thrown

#### Scenario: Undeclared retry

- GIVEN a request with no retry mode and a `SERVER_ERROR` response
- WHEN it runs
- THEN exactly one request is sent
