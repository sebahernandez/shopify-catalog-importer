# Exploration: shopify-importer-03-stores-and-shopify-gateway (S2)

Slice S2 of the roadmap: `CredentialProvider`, encrypted store records, domain allowlist, connection verification, `ShopifyGateway` port, simulated gateway, read-only HTTP calls, GraphQL client with cost tracking and error classification. Depends on S0 (archived); S1 is archived and independent. Labels: [V] verified by reading code, or a page read on 2026-10-14; [U] unverified; [D] proposed default. Shopify pages were read through WebFetch, which returns model-summarized text, so signatures marked [V] must be re-checked against the schema during design. Community-forum statements are by Shopify staff but are not official documentation; they are marked "staff post".

## 1. Current state relevant to S2 [V]

### 1.1 Secrets
- `SecretBox` port (`apps/api/src/shared-kernel/secret-box/secret-box.port.ts`): `encrypt(plaintext, context): string` and `decrypt(envelope, context): string`, synchronous, throws `SecretBoxError` with codes (`MALFORMED_ENVELOPE`, `DECRYPT_FAILED`, `INVALID_INPUT`, `INVALID_KEY`, `KEY_MISSING`). Errors never carry key, plaintext or envelope.
- `AesGcmSecretBox`: AES-256-GCM, random 12-byte IV, 16-byte tag. Envelope text is `sb1.<keyId>.<iv>.<ciphertext>.<tag>` (base64url). The AAD is `sb1|<keyId>|<context>`, so the `context` string binds an envelope to a place. S2 should use a context such as `store:<id>:credentials`, which stops an envelope from being moved to another row or field. Plaintext limit 262,144 bytes. Constructed from a `Keyring` (map of keyId to 32-byte key, plus active key id), so rotation is structurally possible but there is no rotation tool.
- The key lives in a file named by `SECRET_KEY_FILE`; no env var carries key material. `key-boot.ts` loads, generates and reconciles the key with a key-check row in `app_setting`. `registerKeyring` adds every textual form of the key to the logger's process-wide redactor.
- **Gap that S2 must close:** no Nest provider for `SecretBox` exists. `AesGcmSecretBox` is only instantiated inside `SecretKeyBootstrap`. The keyring is final only inside `bootstrap()` after the database connects and `reconcileKey` runs, which is after `NestFactory.create`. S2 needs a lazy holder (a `SECRET_BOX` token whose implementation is bound with the keyring in `bootstrap()`, mirroring `registerKeyring`), or an equivalent boot change. This is a design decision for the proposal.

### 1.2 Database
- Schema has one model, `AppSetting` (`app_setting`: key, value, updated_at); the baseline migration creates only that. Prisma 7.10 with `prisma-client` generator, output `src/generated/prisma` (ignored), better-sqlite3 driver adapter, WAL, foreign keys on.
- `PrismaService.connect()` refuses to continue only when `app_setting` is missing; it does not check later tables. A store table added by S2 would not be detected as "migration required" unless the check is extended.
- `baseline-migration.int.test.ts` asserts the table list is exactly `_prisma_migrations` and `app_setting`. A second migration forces an edit to this test in the same unit.
- Spec constraint: `secret-protection` has "No credential persistence in S0" (database holds no stored credential). S2 needs a delta that replaces it. `runtime-configuration` says the API version "is never used to call Shopify" in S0. S2 needs a delta for that sentence.
- No `Clock` or `IdGenerator` port exists in the kernel (only money, logging, secret-box, boot-error). S2 needs at least a clock for token expiry and throttling; ids can use `randomUUID` in infrastructure or a small port [D].

### 1.3 Configuration
- `SHOPIFY_API_VERSION` default `2026-10`, validated by `^\d{4}-(01|04|07|10)$`, exposed in `AppConfig.shopifyApiVersion` and in the health endpoint. It is the single source; the gateway must take it from config and not repeat the literal.
- Every schema variable must appear in `env.example` (checked by `env-example.test.ts`); the real env file is read only in `apps/api/src/config/`. Any new variable (for example a request timeout) costs a config unit plus an example line. Constants in code avoid that; see Q8.

### 1.4 Local security
- `evaluateRequest`: Host must be allow-listed on every method. Non-safe methods with an `Origin` must have an allow-listed one; with no `Origin`, `Sec-Fetch-Site` must be absent, `same-origin` or `none`. GET, HEAD and OPTIONS skip the Origin rule.
- Consequences for S2: (1) any endpoint that causes an outbound call or changes state (verify, create, replace credentials, delete) must be non-GET so it is origin-guarded; (2) a GET can be triggered cross-site (the browser blocks reading the response, but the request still runs), so GET handlers must be side-effect free and never return secrets; (3) there is no authentication, so any local process can call any route, including creating or replacing store credentials. This is the documented residual risk in the README (`Seguridad local`) and must be listed in the S2 limitations.
- `CORS_ALLOWED_METHODS` list was not read in full [U]: check that `PUT` and `DELETE` are allowed if the design uses them; in practice the web app uses the same-origin Vite proxy, so CORS may be irrelevant.

### 1.5 Logging and redaction
- `RedactingLogger` plus `redact()`: redacts values under key names containing `authorization`, `cookie`, `token`, `secret`, `password`, `signature`, `credential`; keys ending in `apikey`, `privatekey`, `accesskey` and similar; strings matching `shp??_...`, `Bearer ...`; URL userinfo and query parameter values; and any registered secret of at least 8 characters.
- Gotcha: key-name matching is by substring. A log field named `credentialKind` or `tokenExpiresAt` would be printed as `[REDACTED]`. Use names such as `authKind` and `expiresAt`.
- `registerSecret` has no unregister. Registering each decrypted token or client secret works, but the registry grows with every 24-hour token refresh (a few strings per day; acceptable, note it).
- Redaction is best effort (comment in code); S2 must also avoid putting secrets in error messages in the first place, then prove it with seeded-secret tests.

### 1.6 Contracts and web
- `ApiError.error.code` is a closed `z.enum` of five codes; `api-error.test.ts` enumerates them. Adding S2 codes means editing the enum and that test (S1 learned the same). Contracts import zod only, no Node built-ins (eslint-enforced).
- Web: health page only, same-origin client with injected `fetchFn`, Spanish text in `i18n/es.ts`, no `features/` folder. S2 adds no screens.

### 1.7 Layering rules (`eslint.config.js`)
- Kernel and `*.port.ts` files cannot import other modules; `OTHER_MODULES` lists `persistence`, `local-security`, `health`, `config`, `catalog-workbook`. S2 must add its module name(s).
- `catalog-workbook/{domain,application}` has a purity rule (no `node:*`, Nest, Prisma, infrastructure). S2 should add the same block for its module. Note: the domain must then avoid `node:crypto`/`node:net` (use the global `URL` and regexes), and token caching must take a clock from a port.

### 1.8 S1 module as layout model
`catalog-workbook/` has `domain/`, `application/` (use cases, `*.tokens.ts`), `ports/` (`*.port.ts`), `infrastructure/{http,ooxml,reader,zip}`, `test-support/`, and a `*.module.ts` with `forRoot()` building providers by factory and tokens (Symbols), registered in `AppModule.forRoot` and in `OTHER_MODULES`. Controllers are thin; an exception filter maps typed errors to `ApiError`. Tests are co-located, `*.int.test.ts` for HTTP and files. S1 left no extension point for S2 other than this pattern; it has no Shopify code. S1's `ubicacion` (location name) is validated only for shape and is resolved by S4 against locations that S2's gateway returns.

## 2. D1: how a local single-operator app obtains an Admin API token (NOT decided here)

Facts read on 2026-10-14:

| # | Fact | Label | Source |
|---|---|---|---|
| F1 | New legacy custom apps (created in the store admin, `shpat_` token) cannot be created after 2026-01-01. | [V] staff post and changelog quote | https://community.shopify.dev/t/access-tokens-are-being-deprecated/26345 ; https://community.shopify.dev/t/legacy-custom-apps-workaround/32032/2 |
| F2 | Existing legacy apps and their tokens keep working ("Existing tokens remain valid", staff, 2026-03-09). No end-of-life date for them was found. | [V] staff post; EOL policy [U] | same threads |
| F3 | The authentication overview says apps created in the admin "can no longer be created" and Shopify pre-generated a token at install. | [V] | https://shopify.dev/docs/apps/build/authentication-authorization |
| F4 | All new custom apps go through the Dev Dashboard. | [V] staff post | thread 32032 |
| F5 | Client credentials grant: `POST https://{shop}.myshopify.com/admin/oauth/access_token`, form body `grant_type=client_credentials`, `client_id`, `client_secret`. Response `access_token`, `scope` (the scopes configured on the app version, not requested), `expires_in` always 86399 (24 h). Token is not visible in the admin. | [V] | https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens |
| F6 | Client credentials only work when the app and the store are in the same organization; otherwise the error is "Oauth error shop_not_permitted: Client credentials cannot be performed on this shop." Typical causes: a dev store created outside the Dev Dashboard, different organizations, a client's store. | [V] | same page |
| F7 | Using the client id or secret directly against the GraphQL API yields "Invalid API key or access token"; the exchange comes first. | [V] | same page |
| F8 | Authorization code grant is for apps outside the admin: redirect to `https://{shop}/admin/oauth/authorize` with `client_id`, `scope`, `redirect_uri`, `state`; callback carries `code`, `hmac`, `shop`, `state`, `timestamp`; the app must verify state, verify the HMAC with the client secret, and match `shop` against an anchored `*.myshopify.com` pattern; exchange at `POST https://{shop}/admin/oauth/access_token` with `client_id`, `client_secret`, `code` (+ `expiring=1`). Offline token is the default. The redirect URI must exactly match one configured in the Dev Dashboard. | [V] | https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant (only the first 100,000 of 138,374 characters were read) |
| F9 | Expiring offline tokens: response includes `expires_in` (example 3600), `refresh_token`, `refresh_token_expires_in` (7,776,000 = 90 days); refresh with `grant_type=refresh_token`. "New public apps must use expiring offline tokens." A staff post (2026-01-16) says the non-expiring offline token stays valid until uninstall. Whether a custom-distribution or private app may still get a non-expiring token is not stated. | [V] for the expiring mechanics; non-expiring status [U] (contradictory sources) | pages above; https://community.shopify.dev/t/is-it-still-possible-to-create-a-custom-app-for-a-single-store-admin-storefront-access-without-partner-dashboard-cli/28387 |
| F10 | Whether `http://localhost` or `127.0.0.1` redirect URIs are accepted in the Dev Dashboard is not stated in official docs; community workarounds with a loopback redirect exist and one thread reports "redirect_uri is not whitelisted" and host-matching errors. | [U] | https://community.shopify.dev/t/question-about-using-localhost-redirect-urls-for-shopify-oauth/32946 (search result only, not fetched) |
| F11 | Token exchange is for apps embedded in the Shopify admin (ID token exchange), not for a local standalone app. | [V] | authentication overview |
| F12 | For stores outside the organization the client-credentials page points to custom distribution, then token exchange or authorization code grant. The mechanics of custom distribution were not read. | [V] pointer; mechanics [U] | get-api-access-tokens page |
| F13 | Admin API header is `X-Shopify-Access-Token`; endpoint `https://{store}.myshopify.com/admin/api/2026-10/graphql.json`, POST. | [V] | https://shopify.dev/docs/api/admin-graphql |

Options:

| Option | How the operator gets access | Fits | Consequences for S2 | Size |
|---|---|---|---|---|
| A. Client credentials | Operator creates an app in the Dev Dashboard, installs it on a store of the same organization, pastes client id and secret. App exchanges for a 24 h token. | Stores in the operator's own organization (F6) | Store `client_id` and `client_secret` encrypted. Token cache in memory with refresh before expiry (single-flight, margin about 60 s, plus one forced refresh on 401/ACCESS_DENIED). New failure kinds: `shop_not_permitted`, invalid client. A mid-run expiry during long imports (S5) must refresh transparently. | Medium: about 1.5 units more than a static token |
| B. Static token | Operator pastes an Admin API token from an existing legacy custom app (`shpat_`). | Operator already has legacy apps (F2) | Simplest: one encrypted string, no refresh. A 401 means "replace the token". Risk: Shopify may sunset legacy tokens (date unknown, F2). Cannot be created for new stores (F1). | Low |
| C. Authorization code with local redirect | Operator creates a Dev Dashboard app with a redirect URI on the local API, runs the install flow, app stores an offline token (non-expiring or expiring with refresh token). | Stores outside the organization (F6, F12) | Needs: authorize and callback routes, `state` nonce store, HMAC verification, shop pattern check, token exchange, refresh logic for expiring tokens, redirect URI feasibility (F10 [U]). The callback is a GET with a side effect, so the `state` nonce is its only CSRF defence (the Origin rule does not cover GET). | Large: about 3 to 4 more units |
| D. Token exchange | Not applicable to a standalone local app (F11). | No | None | n/a |
| E. Paste any token obtained elsewhere (for example from a CLI or an OAuth done by hand) | Same storage as B. Expiry unknown. | Edge cases | Covered by kind `static_token`; 401 tells the operator to replace it. | Free with B |

Questions that decide D1: which stores will the operator connect (own organization, a client's store, a store with an existing legacy app); does a legacy custom app already exist; is a one-time manual OAuth acceptable.

**Recommended default [D] (maintainer decides):** a `CredentialProvider` port with two adapters in S2, `static_token` (B/E) and `client_credentials` (A). OAuth (C) becomes a later adapter behind the same port; only the stored record shape needs `kind` as a discriminator so that nothing is rebuilt. If the maintainer's stores are all legacy apps, S2 shrinks by about 1.5 units; if a client store without a legacy app is needed, C is unavoidable and should become its own slice.

## 3. Domain model

### 3.1 Store record
Multi-store, one operator, no user table. A store is identified by an internal id (UUID) and a unique canonical shop domain.

| Field | Notes |
|---|---|
| `id` | UUID generated in the application layer |
| `displayName` | operator label, 1 to 80 characters, text only (rendered as text by the UI; S6 handles escaping) |
| `shopDomain` | canonical `<handle>.myshopify.com`, lower case, unique |
| `shopifyShopId` | GID from `shop.id`, null until first verification |
| `apiVersion` | version used at the last verification |
| `credentialKind` | `static_token` or `client_credentials` (discriminator) |
| `credentialsEnvelope` | one `SecretBox` envelope of a JSON payload (`{accessToken}` or `{clientId, clientSecret}`), context `store:<id>:credentials` |
| `status` | `UNVERIFIED`, `CONNECTED`, `AUTH_FAILED`, `SCOPE_MISSING`, `UNAVAILABLE` (derived from the last verification result) |
| `lastVerifiedAt`, `lastVerification` | timestamp plus a small JSON snapshot stored as TEXT (shop name, currency, plan label, granted scopes, missing scopes, location count). Locations themselves are returned live, not persisted [D]. |
| `createdAt`, `updatedAt` | |

Prisma: new model `Store` mapped to `store`, timestamps as DATETIME like `app_setting`, JSON as TEXT (the roadmap already warns against `Json` on SQLite). Unique index on `shop_domain`. S4/S5 will reference `store.id`; S2 should not prejudge deletion semantics beyond "remove deletes the row and the credentials" (Q3).

### 3.2 Shop domain value object (SSRF guard)
- Accept input forms [D]: bare handle `mystore`, `mystore.myshopify.com`, or a pasted URL (`https://mystore.myshopify.com/admin/...`) from which only the host is taken. Everything else is rejected: userinfo, port, path other than the optional admin path, IP literals, IDN or punycode, uppercase is lowercased, trailing dot, backslashes, percent-encoding, whitespace, multiple labels before `myshopify.com`.
- Canonical pattern [D]: `^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$` for the handle, always followed by the fixed suffix `.myshopify.com`. Shopify's documented guidance is an anchored `*.myshopify.com` match (F8, [V]); the exact allowed handle grammar and maximum length are [U] (research question Q-R2). The pasted `admin.shopify.com/store/<handle>` form is accepted by many tools but is [U]; reject it with a message that asks for the myshopify domain [D].
- The request URL is built only from the validated handle with a fixed scheme, fixed path and no port. The suffix is a code constant, not configuration, so there is nothing to misconfigure. The HTTP adapter rejects any `Request` it did not construct itself.
- `redirect: 'error'` on every call: a renamed store may answer with a redirect to another domain [U]; following it would break the allowlist. The user-facing message says the store moved or the domain is wrong.
- Custom domains are not accepted; the operator must use the myshopify domain.

### 3.3 Connection verification result
One use case `VerifyStoreConnection` calls three small gateway operations (smaller blast radius and clearer error attribution than one combined query):

| Gateway op | GraphQL | Needs scope |
|---|---|---|
| `getShopInfo` | `shop { id name myshopifyDomain currencyCode plan { publicDisplayName shopifyPlus partnerDevelopment } }` | none stated [V] (Shop page says none) |
| `getGrantedScopes` | `currentAppInstallation { accessScopes { handle } }` | none stated [V] |
| `listLocations` | `locations(first: N, includeInactive: false) { nodes { id name isActive fulfillsOnlineOrders } pageInfo { hasNextPage endCursor } }` | `read_locations`, `read_inventory` or `read_markets_home` [V] (Location page) |

`ShopPlan.displayName` is deprecated; use `publicDisplayName` [V]. Maximum `first` and default page size for `locations` are not stated [U]; paginate with a cap [D] 250 locations and return a `truncated` flag.

Returned `StoreVerification` (contracts): `ok`, `checkedAt`, `shop { id, name, currencyCode, planName, shopifyPlus, partnerDevelopment }`, `apiVersion { requested, used? }`, `scopes { granted[], required[], missing[] }`, `locations[]`, `problems[]` (each with a `kind` from the taxonomy and a Spanish-ready code plus params, S1 style). Missing scopes are computed with the documented implication "a write scope also grants the read scope" [V], so granting `write_products` satisfies a `read_products` requirement. A required capability set (a constant in contracts) rather than a list of handles avoids false negatives: for example locations are satisfied by any of the three scopes.

Required scopes for the whole MVP [D, each confirmed against pages except where marked]: `write_products` (covers product reads, `productSet`, media attach and reorder) [V]; `write_files` (`fileCreate`, file status) [V]; `write_inventory` (quantities, activation) [V]; locations by `read_locations` or `read_inventory` [V]. The scope for `stagedUploadsCreate` is not stated on the pages read [U] (research Q-R6). The check in S2 compares against this set, even though S2 itself only reads.

### 3.4 Error classification taxonomy (gateway level)
A typed `ShopifyGatewayError` with `kind`, `retryable`, optional `retryAfterMs`, a fixed safe message, and no raw body.

| Kind | Signal | Label |
|---|---|---|
| `AUTH_FAILED` | HTTP 401, GraphQL error code `ACCESS_DENIED` "doesn't have correct authentication credentials", or "Invalid API key or access token" | [V] for the code and meaning; exact JSON for a bad token [U] |
| `SCOPE_MISSING` | GraphQL `ACCESS_DENIED` attributed to a specific field, with a required-access hint in the message or extensions | code [V]; the shape of the required-access hint [U] (research Q-R3) |
| `SHOP_UNAVAILABLE` | HTTP 402 (frozen), 423 (locked), GraphQL `SHOP_INACTIVE`; 403 means the shop is forbidden (marked fraudulent) | [V] |
| `STORE_NOT_FOUND` | HTTP 404 for an unknown shop domain | 404 meaning "resource not available" [V]; that it is what an unknown shop returns [U] |
| `THROTTLED` | GraphQL error `extensions.code = THROTTLED`; HTTP 429 | code documented on the API reference page [V]; the rate-limits page does not mention the code [V that it is absent]; the HTTP status of a throttled GraphQL call [U] |
| `QUERY_TOO_COSTLY` | `MAX_COST_EXCEEDED`; single query limit 1,000 points | [V] |
| `SERVER_ERROR` | 5xx, `INTERNAL_SERVER_ERROR` | [V] |
| `VERSION_UNSUPPORTED` | requested version rejected, or the response reports a different version | mechanism [U] (research Q-R4) |
| `NETWORK` / `TIMEOUT` | DNS, refused, TLS, abort | n/a |
| `INVALID_RESPONSE` | non-JSON, wrong content type, oversize body, schema mismatch (for example an HTML maintenance page) | n/a |
| `GRAPHQL_ERROR` | any other `errors[]` entry | n/a |
| `CREDENTIAL_EXCHANGE_FAILED` | client-credentials token endpoint failure; `shop_not_permitted` is a named sub-case | message text [V]; HTTP status and body shape [U] |

## 4. `ShopifyGateway` port, client, HTTP adapter

### 4.1 Port (S2: reads only; S5 adds writes)
Operations: `getShopInfo`, `getGrantedScopes`, `listLocations` (all required for verification). The roadmap also lists `findProductByHandle`, `findProductByCustomId`, `getFileStatus`; these are tier B checks used in S4 and must not be forced into S2 [D]; add them in S4 with their fixtures. This keeps the S2 port minimal and verifiable. Every operation takes a `StoreConnection` value (canonical domain, api version, `CredentialProvider`) so the gateway is stateless regarding stores and callers can use many stores concurrently. The port file lives under `ports/` and may not import infrastructure.

### 4.2 Simulated gateway
`SimulatedShopifyGateway`: in-memory shops keyed by domain with name, currency, plan, granted scopes, locations; injectable faults per operation and per call count (`AUTH_FAILED`, `SCOPE_MISSING`, `THROTTLED` with a `retryAfterMs`, `NETWORK`, `TIMEOUT`, `SERVER_ERROR`, `VERSION_UNSUPPORTED`, `INVALID_RESPONSE`), with deterministic ordering and no real timers. It serves as the contract-test reference, demo mode in S6/S7, and the fixture for S4/S5. It must classify faults using the same `ShopifyGatewayError` type so use cases never see adapter-specific exceptions.

### 4.3 GraphQL client (own, thin)
- `execute({ query, variables, retry: 'safe' | 'none' })`: POST JSON to the fixed URL `https://<domain>/admin/api/<version>/graphql.json` with `X-Shopify-Access-Token`, `Content-Type: application/json`, `Accept: application/json`. Node 24 global `fetch`; `AbortSignal.timeout` for a per-request timeout [D] 15 s for reads; `redirect: 'error'`; response size cap [D] 2 MB for S2 reads (S5 may raise); content-type check; JSON parse inside try. The `fetch` function is injected, which is how recorded fixtures and the simulator contract tests run without sockets.
- No secrets in URLs or errors: the token is only in a header; the client-secret is only in the token-endpoint form body. Undici errors (`fetch failed`, cause with code) are mapped to `NETWORK` with the code only, never the original error object, because causes can carry the URL and request details.
- Cost tracking [V from rate-limits page]: read `extensions.cost.{requestedQueryCost, actualQueryCost, throttleStatus.{maximumAvailable, currentlyAvailable, restoreRate}}` from every response. The bucket is a leaky bucket per app and store pair; restore rate is 100 points/s Standard, 200 Advanced, 1,000 Plus, 2,000 enterprise; a single query cannot exceed 1,000 points; mutations cost 10; object fields 1, scalars and enums 0, connections by `first`/`last`. The page does not state a per-plan maximum bucket size (the 1000/50 in its example are illustrative). So the tracker must trust `throttleStatus` from responses and not assume plan numbers. The header `Shopify-GraphQL-Cost-Debug=1` returns per-field cost and is useful in an opt-in debug mode only.
- `ThrottleTracker` (pure, injected clock): per-store state (last `currentlyAvailable`, `restoreRate`, `maximumAvailable`, timestamp); `waitTimeFor(estimatedCost)` returns 0 or the delay; `observe(throttleStatus)`. S2 read queries have declared hand-computed estimated costs; S5 will extend. Concurrency control stays in S5 (S2 documents that a per-store limiter is needed).
- Retry policy [D]: reads only (`retry: 'safe'`), at most 3 attempts, exponential backoff with full jitter starting at 1 s (Shopify's recommended backoff is "about one second" [V]); retry on `THROTTLED`, 429, 5xx, `NETWORK`, `TIMEOUT`; honour `Retry-After` if present [U for GraphQL]; never retry `AUTH_FAILED`, `SCOPE_MISSING`, `SHOP_UNAVAILABLE`, `QUERY_TOO_COSTLY`; for client-credentials, one forced token refresh then one retry on `AUTH_FAILED`. Jitter source and sleeper injected, so tests are instant. Mutations must default to `retry: 'none'` in the type so S5 cannot retry a non-idempotent create by accident (productCreate and productSet are not idempotent per the roadmap research).

### 4.4 Library choice

| Option | Findings | Verdict |
|---|---|---|
| `@shopify/admin-api-client` 2.0.1 | One dependency (`@shopify/graphql-client` ^2.0.1), MIT, ESM exports present with a `.mjs` entry and a CJS entry, no `type` field. Options `storeDomain`, `apiVersion`, `accessToken`, `retries` (default 0, max 3, only for 429/503 and abandoned requests), `customFetchApi`, `logger`. Returns `errors` (`networkStatusCode`, `message`, `graphQLErrors`, `response`) and `extensions` with the cost object. [V from registry and README via WebFetch] | Viable as a transport, but: retries do not understand `THROTTLED` inside HTTP 200 or the bucket state [U whether 200 THROTTLED is retried], no documented timeout, no documented domain validation [U], so classification, allowlist, redirect refusal, tracker and secret hygiene stay ours. Net saving about 150 lines. A new dependency in the supply chain for a request-building function. Not chosen for the default; revisit if a spike shows value. |
| Own thin client | About 250 lines including tests of the pieces above; full control of errors and logging; no new dependency; types for the 3 queries written by hand with zod parsing. | Recommended |

## 5. API surface and web

Routes under the global prefix `api` [D] (all JSON; none returns a secret):

| Route | Purpose | Guarded |
|---|---|---|
| `POST api/stores` | create (displayName, domain, credentials discriminated by kind); no outbound call; status `UNVERIFIED` | yes |
| `GET api/stores` and `GET api/stores/{id}` | list and read the summary (no credentials, no envelope) | Host only |
| `POST api/stores/{id}/verify` | outbound verification; persists the snapshot and status; returns `StoreVerification` | yes |
| `PUT api/stores/{id}/credentials` | replace credentials (token rotation, 401 recovery), resets status to `UNVERIFIED` | yes |
| `DELETE api/stores/{id}` | remove the store and its credentials | yes |

Left to S6: all screens, store picker and "selected store" state, demo banner, Spanish copy, the Shopify connection guide (S7). Left to S4: tier B product lookups. A single-step "connect = create + verify" endpoint is a UI convenience that can be composed client-side in S6 [D].

Local-security implications: verification is POST so the Origin rule applies; error bodies are fixed `ApiError` messages (no request echo); the JSON body parser must not log bodies; HTTP validation errors never include the offending value; a response returns a `hasCredentials` boolean at most, never an envelope or a masked token (a masked suffix leaks entropy for short tokens); `Cache-Control: no-store` on all store routes, as S1's routes do. Status codes [D]: 400 invalid body or domain, 404 unknown store, 409 duplicate domain, 502/503/504 style codes for verify failures are NOT used; verification returns 200 with `ok: false` and typed problems (the request itself succeeded), same model as S1's validate endpoint. New `ApiError` codes [D]: `STORE_NOT_FOUND`, `STORE_DOMAIN_INVALID`, `STORE_ALREADY_EXISTS`, `STORE_CREDENTIALS_INVALID`; requires the closed enum plus its test to change in the contracts unit.

## 6. Approaches

| # | Approach | Pros | Cons | Effort | Verdict |
|---|---|---|---|---|---|
| A | Thin own client plus `ShopifyGateway` port plus simulator, two credential kinds behind `CredentialProvider` | Full control of classification, allowlist, redaction; no new dependency; simulator and HTTP adapter share one contract suite; OAuth can be added without schema change | More code than the library; Shopify response shapes are known only from docs until a store is tested | Medium-High | Recommended |
| B | Official `@shopify/admin-api-client` as the transport inside our adapter | Less request plumbing; Shopify keeps up with protocol details | Still need our own error classification, tracker, allowlist, timeout and redirect policy; retry semantics differ from ours; a dependency whose behaviour on 200-with-THROTTLED is not documented | Medium | Alternative; reconsider after an opt-in spike |
| C | Ship only the port and simulator now; defer the HTTP adapter and the token exchange to S4/S5 | Smallest slice; fewest unverifiable claims | S4 needs real reads for tier B and verification cannot be demonstrated against Shopify at all; just moves the unverified work | Low | Rejected: the roadmap assigns the read-only HTTP adapter to S2 |
| D | Include the OAuth authorization code flow in S2 | Works for any store | Roughly doubles the slice; localhost redirect not documented [U]; needs a GET callback with its own CSRF reasoning | High | Rejected unless D1 says it is required; make it its own slice |

## 7. Suggested slicing (hand-written lines; uncertainty about 35 percent; 400-line review budget per PR)

| Unit | Content | Est. | Depends on |
|---|---|---|---|
| U1 | Contracts: store schemas, `StoreVerification`, `ShopifyErrorKind`, required scope set, new `ApiError` codes plus test edits | ~280 | none |
| U2 | Domain: `ShopDomain` value object, allowlist and canonicalization, store entity and status rules, credential payload types; tests | ~320 | U1 |
| U3 | Persistence: Prisma `Store` model, second migration, repository port and adapter, `connect()` table check, baseline-migration test update | ~340 | U2 |
| U4 | `SECRET_BOX` lazy holder and boot binding, credential serialization with `store:<id>:credentials` context, `CredentialProvider` port, static-token adapter | ~320 | U2 |
| U5 | Client-credentials provider: form exchange, expiry cache with margin, single-flight, forced refresh, error mapping, injected clock and fetch | ~370 | U4 |
| U6 | `ShopifyGateway` port, `ShopifyGatewayError` taxonomy, simulated gateway with fault injection | ~380 | U1 |
| U7 | GraphQL client core: request build, timeout, redirect refusal, size cap, parse, classification, cost extraction | ~380 | U6 |
| U8 | `ThrottleTracker`, retry and backoff policy with fake clock | ~300 | U7 |
| U9 | HTTP read operations (3 queries), zod response parsing, hand-authored fixtures labelled by provenance | ~350 | U8 |
| U10 | Shared gateway contract suite run against the simulator and the fixture-backed HTTP adapter | ~260 | U6, U9 |
| U11 | `VerifyStoreConnection` use case: scope diff with implication rule, status mapping, snapshot persist | ~340 | U3, U10 |
| U12 | Store use cases (create, list, get, replace credentials, delete) | ~330 | U3, U4 |
| U13 | Controller, exception filter, module wiring, `AppModule` and eslint layering edits, integration tests (origin guard on every write route) | ~390 | U11, U12 |
| U14 | Leak tests across logs, errors and responses, spec deltas, README limitation edits | ~260 | U13 |
| Optional | Opt-in live smoke script or skipped test for a dev store (reads env only via config) | ~150 | U9 |

Total about 4,300 lines in 14 units (S0 and S1 each needed 16 to 17). U5 is dropped if D1 selects static tokens only; U12/U13 grow slightly if OAuth is added (not recommended in this slice). U7 and U13 are the most likely to exceed the budget and may split.

Spike candidates: none can use a real store. A documentation-only spike inside U9 (writing the three queries and checking each field against the 2026-10 schema pages) is part of the unit. What can be verified without a store: URL and header construction, redirect and timeout behaviour with an injected fetch, all classification branches on hand-written responses, cost-tracker math with a fake clock, token cache and refresh logic, encryption round trip, origin guard, secret non-leakage. What must be flagged unverified until the operator tests against a development store: the exact JSON of throttled, access-denied and bad-token responses, HTTP status of throttling, `Retry-After`, version-mismatch behaviour, redirect on renamed shops, the client-credentials error body, `locations` page size, actual granted scope strings, plan field values. Fixture files must carry a provenance tag ("hand-authored from documentation" versus "recorded") and the README `Qué se verificó y qué no` must keep stating that nothing was verified against a real store.

## 8. Test strategy
- Strict TDD, co-located tests; pure domain and tracker tests are unit; repository, client, controller and contract suites are `*.int.test.ts`. No network in CI: the client takes an injected `fetch`; token-endpoint tests use the same mechanism. Existing precedent for loopback sockets exists but is not needed here.
- Contract suite: one parameterized suite over the `ShopifyGateway` port, run against the simulator and against the HTTP adapter with a scripted fetch that returns fixture responses; both must produce the same `StoreVerification` and the same error kinds.
- Classification table tests: each documented signal in section 3.4 maps to one kind; unknown shapes fall to `GRAPHQL_ERROR` or `INVALID_RESPONSE`, never a thrown raw error.
- Throttling and retry: fake clock and sleeper; assert delays, attempt counts, no retry of non-retryable kinds, no retry of `retry: 'none'` calls.
- No-leak proof: seed distinct canary values (token, client secret, an `shp*_` look-alike, a Bearer string) through create, verify (success and every failure kind), replace and delete; capture the logger sink, every `ApiError` body, every thrown error `message` and `cause` chain, and the JSON of all responses; assert none contains a canary in any encoding the redactor covers; assert the database row holds only an envelope (no plaintext substring); assert decryption with a different context or another row's id fails. Also assert the Prisma and Nest layers do not log request bodies.
- Security tests: foreign `Origin` on POST, PUT and DELETE returns 403 and the handler does not run; GET routes work with a foreign Origin but return no secret; `redirect: 'error'` and rejected hosts (userinfo, ports, lookalike suffixes such as `myshopify.com.evil.example`, `evilmyshopify.com`, IP literals, Unicode confusables) never reach `fetch`.
- Real Shopify behaviour cannot be tested here; the report must say so.

## 9. Risks

| Severity | Risk | Mitigation |
|---|---|---|
| High | D1 undecided: the operator may not be able to connect their stores with the simple flow (client credentials limited to one organization; legacy tokens cannot be created; OAuth is large and its localhost redirect is undocumented [U]). | Decide D1 before proposing; the two-kind port keeps OAuth additive. |
| High | Nothing is verified against a real store; classification of throttle, scope and version errors rests on documentation and hand-authored fixtures. | Provenance-tagged fixtures, README statement, opt-in smoke unit, research Q list. |
| High | No `SecretBox` provider exists; wiring it at boot touches `main.ts` and the boot order. | Lazy holder bound after `reconcileKey`; its own unit and tests. |
| Medium | A secret can still leak through an unexpected path (undici error causes, Nest default exception text, validation messages). | Fixed messages, error mapping that drops causes, canary tests across every path. |
| Medium | Local API has no authentication: any local process can replace or delete credentials. | Document in README limitations; not solvable in S2. |
| Medium | Shopify may sunset legacy tokens or change client-credentials rules; end-of-life for legacy tokens not found. | Keep the kind discriminator; surface `AUTH_FAILED` with a clear next action. |
| Medium | `baseline-migration.int.test` and `ApiError` closed enum break when extended; `connect()` ignores later tables. | Edit both tests in the same units; extend the migration check. |
| Medium | Log redaction by key substring will mask innocent fields such as `credentialKind`; the registry of secrets only grows. | Naming rule in the design; document growth. |
| Low | Unit sizes: U7 and U13 can exceed 400 lines. | Pre-plan splits. |
| Low | Spanish text for new error and problem codes is S6's job; S2 returns codes and params. | Follow the S1 catalog approach. |

## 10. Open product questions (proposed defaults), by importance

1. **D1 credential model.** Options: (a) client credentials plus static token behind one port [D]; (b) static token only (smallest, depends on a legacy app existing); (c) client credentials only; (d) add OAuth authorization code now (own slice, +3 to 4 units). Consequences in section 2. Needed before the proposal.
2. **Which stores will be connected first, and does a legacy custom app already exist?** Default: operator's own organization stores, plus any existing legacy token.
3. **Store removal semantics.** Options: hard delete of row and credentials [D for S2]; soft "disconnect" keeping the record for ledger history (S5 relevance); block removal when plans or runs exist (S4 adds). Consequence: S4 needs an FK policy.
4. **Create versus connect.** Options: two steps, create then verify [D]; one step that saves only after a successful identity call (fewer stuck rows, harder error model).
5. **Shop domain input forms.** Default: handle, `<handle>.myshopify.com`, or a pasted URL from which only the host is used; reject custom domains and `admin.shopify.com/store/...`.
6. **Pinned API version.** The default is `2026-10` in the code (it is the existing config default), while the roadmap recommended `2026-07` (D2). S2 starts using the value, so the maintainer should confirm now. Consequence: on 2026-10 the `barcode` field is deprecated in favour of `barcodes` (S5's concern); verification queries here are version-neutral.
7. **Required scope set and who owns it.** Default: a constant in contracts (`write_products`, `write_files`, `write_inventory`, locations by any of three scopes); the scope for `stagedUploadsCreate` is [U].
8. **Timeouts, retries and caps as constants or env variables.** Default: constants in code (15 s, 3 attempts, 2 MB, 250 locations); env variables only if the operator needs to tune them (each costs a config unit and `env.example` lines).
9. **Locations in the verification response.** Default: returned live and not persisted; persist only a count. Alternative: persist a snapshot for the UI (stale-data risk).
10. **Behaviour when the stored version differs from the config version.** Default: re-verify on demand; `apiVersion` records the last verification.
11. **Single module versus two (`stores`, `shopify-gateway`).** Default: one `stores` module with gateway ports inside (the roadmap lists them together); split in S4 if import modules need the gateway without the store use cases.
12. **Opt-in live smoke unit in S2 or S7.** Default: S7, unless a development store is available during S2.

### Research (`sdd-research`) questions, precise
- Q-R1 Is `X-Shopify-API-Version` (or similar) present on GraphQL Admin responses and what happens when the requested version is unsupported or not yet released: error, fall-forward or fall-back, and the exact status and body?
- Q-R2 Exact grammar and maximum length of a store handle in `*.myshopify.com`, whether labels may contain uppercase or underscores, and whether renamed stores redirect (status, target).
- Q-R3 Exact JSON of a GraphQL response with `ACCESS_DENIED` for a missing scope (does `extensions` contain `requiredAccess`? what `path`?) and for an invalid token (HTTP 401 body).
- Q-R4 HTTP status and body of a throttled GraphQL call (`THROTTLED` inside 200 or a 429 with `Retry-After`?), and the maximum bucket size per plan.
- Q-R5 Client credentials: HTTP status and error body for `shop_not_permitted` and for a wrong client secret; token format prefix; whether the exchange response includes anything besides `access_token`, `scope`, `expires_in`.
- Q-R6 Scope required by `stagedUploadsCreate`, and whether `read_files` is needed for file status when only `write_products` is granted.
- Q-R7 Whether a Dev Dashboard app accepts `http://127.0.0.1:<port>` or `http://localhost:<port>` as a redirect URI, and whether custom-distribution apps may obtain non-expiring offline tokens.
- Q-R8 `locations` maximum `first` and default page size; whether a store with no access to locations returns `ACCESS_DENIED` for the whole query or a partial result.
- Q-R9 End-of-life policy for legacy custom app tokens.

## Recommendation
Propose S2 after the maintainer settles D1 (and Q6, Q4 if possible). Use approach A with a `CredentialProvider` supporting `static_token` and `client_credentials`, keep the S2 port to three read operations, put every classification and fixture under a provenance label, and keep all claims of real-store behaviour out of the report.

## Ready for Proposal
Not yet: D1 is a blocking product decision. After the maintainer answers D1 (and ideally Q4, Q6), the orchestrator can run `sdd-propose`; `sdd-research` is optional but worthwhile for Q-R1 to Q-R5 if a development store or more documentation can be read.
