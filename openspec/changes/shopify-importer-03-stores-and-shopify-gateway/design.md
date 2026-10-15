# Design: Stores and Shopify Gateway (S2)

S2 adds one module, `apps/api/src/stores/`. It registers stores with encrypted credentials, obtains Admin API tokens through a `CredentialProvider`, and verifies a connection through a read-only `ShopifyGateway`. It never writes to Shopify, adds no web screen and adds no environment variable.

Marks: **[VS]** = runtime or library behaviour to verify in the named unit (list at the end). **[A]** = behaviour of real Shopify that is not validated (research deferred items Q-R1 to Q-R9); it is an assumption, encoded only in fixtures tagged `hand-authored-from-documentation`, and checked by the live smoke test (S7, Q12). Research claims are cited as C1 to C21. Nothing in this design was verified against a real store.

Precedence: the delta specs (`store-registry`, `credential-provider`, `shop-domain-guard`, `shopify-gateway`, `store-verification`, `store-endpoints`, and the modified `secret-protection`, `runtime-configuration`, `persistence-baseline`) are authoritative for codes, field names, limits, statuses and wording. This design was reconciled with them after they were written; where a value is repeated here it is for orientation, and the spec wins on any difference.

## Technical Approach

Approach A from the proposal: own thin GraphQL client on an injected `fetch`, a `ShopifyGateway` port with a simulator, two credential kinds behind one port. The S0 and S1 conventions are unchanged: explicit `@Inject` tokens, `useFactory` wiring, `forRoot` dynamic modules, co-located `*.test.ts` and `*.int.test.ts`, HTTP tests with `fetch` on an ephemeral loopback port, English `ApiError` messages, Spanish text left to S6.

| Area | May import | Must not import (lint) |
|---|---|---|
| `stores/domain/**` | contracts, pure kernel files | `node:*`, `@nestjs/*`, Prisma, `infrastructure/` |
| `stores/application/**` | domain, ports, contracts, kernel ports | same as domain |
| `stores/ports/*.port.ts` | domain types, kernel ports | existing port rule (`NEST`, `PRISMA`, `OTHER_MODULES`, `INFRASTRUCTURE`) |
| `stores/infrastructure/**` | everything above, `node:crypto`, NestJS, the persistence and config tokens | other modules' internals |

## Architecture Decisions

| # | Topic | Choice | Rejected | Rationale |
|---|---|---|---|---|
| D1 | Module layout | `stores/{domain,application,ports,infrastructure/{http,gateway,credentials,persistence,simulator},test-support}`, `stores.module.ts`, `application/stores.tokens.ts` (Symbols) | Two modules (`stores`, `shopify-gateway`); gateway in the kernel | Q11 and the S1 layout. S4 can split the gateway out if import modules need it without the store use cases |
| D2 | Lint | Add `'**/stores/**'` to `OTHER_MODULES`; add a block for `apps/api/src/stores/{domain,application}/**/*.ts` (tests ignored) with `BUILT_INS`, `NEST`, `PRISMA`, `INFRASTRUCTURE` | Convention only | Same rule as S1. The domain parses hosts with its own grammar (no `node:net`), and time comes from a port |
| D3 | Contracts | New `stores.ts` (credentials payloads, request bodies, summary, statuses, auth kinds), `store-verification.ts` (result, problem, snapshot), `shopify-errors.ts` (`ShopifyErrorKind`, exchange reasons), `shopify-scopes.ts` (`REQUIRED_CAPABILITIES`); `api-error.ts` gains the five store codes and `api-error.test.ts` lists them. Codes and params only, no Spanish | A Spanish catalog now (S1 style) | S6 owns the copy; codes plus params let the web render later. `apps/web` has no `ApiError` code enumeration test (its only mention is one `HOST_NOT_ALLOWED` fixture in `http-client.test.ts`), so no web change |
| D4 | SecretBox wiring | Kernel `DeferredSecretBox` implements `SecretBox`: it throws `SecretBoxError('KEY_MISSING')` until `bind(box)`, and a second `bind` throws. `bootstrap()` creates it before `NestFactory.create`, passes it through `AppModule.forRoot({ secretBox })` into `StoresModule.forRoot`, which provides it as `useValue` under `SECRET_BOX`. It is bound with `new AesGcmSecretBox(keyring)` right after `reconcileKey` and `registerKeyring`, with that same keyring | Async Nest factory that connects and reconciles inside DI; `app.get` then mutate; building the box before reconciliation | Keeps the S0 ordered boot: the keyring is final only after the database connects. Consumers hold the holder and resolve the real box at call time. Routes serve only after `listen`, which follows the bind. A reconciliation failure throws before the bind. Tests pass any `SecretBox` (an `AesGcmSecretBox` over a test keyring) |
| D5 | Credential storage | One envelope per store: `encrypt(JSON payload, 'store:<lowercase id>:credentials')`, payload `{ accessToken }` or `{ clientId, clientSecret }`; `auth_kind` column beside it. `StoreCredentialVault.open` parses the payload against `authKind`; a decrypt failure or a shape mismatch raises `CredentialsUnreadableError` (fixed message, no cause) | One column per secret; kind inside the envelope | Spec `credential-provider`. Context binding stops envelope moves between rows; swapped envelopes become unreadable before any outbound call |
| D6 | Redactor registration | The vault calls the kernel `registerSecret` for `accessToken` and `clientSecret` when it seals or opens, and the exchanger registers every received token before returning it. `clientId` is not registered | Unregister on delete; registering nothing | Defence after "never log it". There is no unregister: the registry grows by about one entry per store per day plus one per replacement and keeps deleted stores' values until restart; `redactString` cost is linear in it. Documented in the README |
| D7 | Credential provider | Port `CredentialProvider { readonly authKind; accessToken(): Promise<string>; refreshAfterRejection(rejected: string): Promise<string \| null> }`. Static: returns the token, refresh returns `null`. Client credentials: cache `{ token, expiresAtMs }`, reuse while `now < expiresAtMs - 60 s`, one shared in-flight promise per store (single-flight; failures are shared, never cached). `refreshAfterRejection` drops the cache and exchanges once, unless the cache already holds a token different from `rejected` (another caller refreshed), which it returns | OAuth now (deferred by D1); refresh logic inside the gateway | Spec `credential-provider`. The "different from rejected" check stops N concurrent 401s from causing N exchanges |
| D8 | Provider lifetime | Singleton `CredentialProviderRegistry` builds providers from a store record and keeps client-credentials providers keyed by store id plus envelope; `forget(storeId)` on replace and delete | A new provider per request | The 24 h token (C10) must survive across requests; keying by envelope also drops a stale cache if `forget` is missed |
| D9 | Time, ids, randomness | Kernel `Clock` port (`nowMs()`) in `shared-kernel/time/` with a system adapter; `IdGenerator` port in `stores/ports/` with a `randomUUID` adapter; `sleep(ms)`, `random()` and `timeoutSignal(ms)` are injected functions of the client | `Date.now()` and `setTimeout` inline; fake timers | Pure domain and application; deterministic tests without fake timers |
| D10 | Shop domain guard | Pure `parseShopDomain(input)` in the domain returning a branded `ShopDomain` or a reason code; own authority parsing, no WHATWG `URL` (algorithm below). The suffix is a code constant | `URL` parsing; configurable suffix; custom domains or `admin.shopify.com` URLs (Q5) | `URL` normalises hosts (for example a numeric host becomes an IPv4 address and Unicode becomes punycode), which would hide what the operator typed; the spec rejects those inputs by reason |
| D11 | URL construction | `shopifyUrls` in infrastructure builds only `https://<domain>/admin/api/<version>/graphql.json` and `https://<domain>/admin/oauth/access_token` from a `ShopDomain` and the config version (re-checked against the config regex). Transport functions accept a `ShopifyRequest` built by that module (private brand), never a string URL | Accepting a URL string | Spec `shop-domain-guard`: raw strings fail at compile time, and at run time the brand check refuses before `fetch` |
| D12 | Transport | Own `ShopifyHttpTransport` over injected `fetchFn`: POST only, `redirect: 'error'`, `timeoutSignal(15 s)` (default `AbortSignal.timeout`), body read through a byte counter that cancels past 2,097,152 bytes, `application/json` content type required (charset allowed), JSON parse in try, no `cause` on any error | `@shopify/admin-api-client` | No new dependency. The library does not document 200-with-THROTTLED handling, a timeout or redirect policy, so classification, caps and hygiene stay ours anyway |
| D13 | Error type | `ShopifyGatewayError { kind, retryable, retryAfterMs?, reason? }`, a fixed message per kind, `reason` only for `CREDENTIAL_EXCHANGE_FAILED` (`SHOP_NOT_PERMITTED` or `UNKNOWN`); `retryable` derived from the kind. Defined in `stores/ports/shopify-gateway-error.ts`, kinds from contracts | Passing Shopify messages through; one kind per status | One error type for both adapters; bodies can echo request data, so none is kept |
| D14 | API version | Version from `AppConfig.shopifyApiVersion` only (Q6, C3); every read returns `apiVersionUsed` from `X-Shopify-API-Version` (null when absent [A]). A difference is not thrown (C1, C2); verification reports it | Throwing on mismatch | The data was served by fall-forward; the use case decides. The stored version is replaced by the result of each verification (Q10) |
| D15 | Throttle and retry | Pure `ThrottleTracker` keyed by canonical domain, fed by `extensions.cost.throttleStatus` from every parsed response (C4: never plan numbers); the client sleeps `waitTimeFor(estimatedCost)` before sending. `RetryPolicy`: `retry` is `'safe' \| 'none'`, absent means `'none'`; safe reads get at most 3 attempts and retry only retryable kinds; wait after failed attempt n is `random() · 1000 · 2^(n-1)`, raised to `retryAfterMs` when present. The forced credential refresh (D7) is one extra attempt per operation outside this count | Equal jitter; a global limiter now | Spec `shopify-gateway`. Concurrency limiting is S5; S5 mutations pass `'none'` |
| D16 | Reads | Three separate queries; locations fetched in pages of 50 until 251 active locations are seen or no page remains, then sorted by name and id, cut at 250, `truncated` true when a 251st existed | One combined query; trusting server order | Clear attribution of `ACCESS_DENIED` to the locations scope; the spec's order and cap are deterministic only after our own sort |
| D17 | Verification | `VerifyStoreConnection` never throws for gateway or credential failures; it returns `ok` false with typed problems and HTTP 200 (Q4) | 5xx for a failed verification | Same model as S1's validate route: the request succeeded, the store did not |
| D18 | Persistence | Prisma model `Store` mapped to `store`, second migration, `last_verification` TEXT parsed with zod on read (a corrupt value reads as null plus a warning event without content), unique index on `shop_domain`; `PrismaService.connect()` checks the list `EXPECTED_TABLES` in `persistence/expected-tables.ts` | Prisma `Json` on SQLite; per-module checks | Roadmap warning on `Json`. The list lives in `persistence`, which must not import `stores` |
| D19 | Stale verification write | `recordVerification` updates `WHERE id = ? AND credentials_envelope = ?`; zero rows means credentials were replaced or the store deleted during the call: the result is returned, not persisted, and `store_verification_discarded` is logged | Revision column; locking | No extra column; prevents a verify started with old credentials from marking new ones `CONNECTED` |
| D20 | HTTP errors | `StoresExceptionFilter` (controller-scoped, catches everything): typed store errors map to `ApiError`; any other error answers 500 with the same generic body Nest uses (no message, no stack) and logs only `{ event: 'store_request_failed', errorName }` | Nest's default handler | The default handler logs the error message, and a Prisma or undici message might carry data [VS 10]. `ApiError` has no internal-error code, so none is invented (S0 rule) |
| D21 | Request bodies | Malformed JSON on a store route must yield 400 `STORE_REQUEST_INVALID` without the parser message. Preferred: the filter of D20 recognises the body-parser error (status 400, type `entity.parse.failed`). If Nest does not route parser errors to controller filters [VS 9], bootstrap creates the app with `bodyParser: false` and the store routes read JSON with a bounded reader (16 KB, S1 pattern) | Accepting Nest's default 400 (its message can quote the body) | Spec `store-endpoints`. No other route consumes JSON bodies today, so the fallback is contained |
| D22 | Simulator placement | `SimulatedShopifyGateway` in `infrastructure/simulator/` (shipped) | `test-support` | S6 demo mode and S4/S5 tests reuse it; `test-support` is excluded from the build |
| D23 | Log field naming | Store log events use only fields declared in `infrastructure/store-log-fields.ts` (`storeId`, `shopDomain`, `authKind`, `expiresAt`, `kind`, `reason`, `attempt`, `delayMs`, `status`, `durationMs`, `errorName`); a test asserts `isSecretKeyName` is false for each. Summaries (which hold `hasCredentials`) are never logged | Free-form fields | The redactor matches key names by substring; `credentialKind` or `tokenExpiresAt` would print as `[REDACTED]`, and `hasCredentials` would too |

## Mechanisms

### Boot order (main.ts)

```
loadConfig -> RedactingLogger -> loadKeyring (+ registerKeyring if a key exists)
-> secretBox = new DeferredSecretBox()
-> NestFactory.create(AppModule.forRoot({ config, logger, secretBox }), { logger, abortOnError: false })
-> PrismaService.connect()   (checks EXPECTED_TABLES: app_setting, store)
-> reconcileKey -> registerKeyring(keyring) -> secretBox.bind(new AesGcmSecretBox(keyring))
-> CORS, prefix 'api', listen, verifyBoundAddress
```

`AppModuleOptions` gains `secretBox` and its `logger` widens to `LoggerPort` (stores logs info and debug events). `no-test-route-ships.test.ts` passes both and expects six imports and the controllers `HealthController`, `WorkbookController`, `StoresController`.

### Shop domain algorithm (domain, pure, first failing step wins)

1. `EMPTY`; any whitespace (`WHITESPACE`); any character outside printable ASCII, including zero-width characters (`NON_ASCII`); `\` (`BACKSLASH`); `%` (`PERCENT_ENCODING`).
2. If the input starts with `http://` or `https://` (case-insensitive), the authority is the text up to the first slash, question mark or hash, and the remainder is path, query and fragment. Otherwise the whole input is the authority candidate and any slash, question mark or hash gives `PATH`.
3. Authority: `@` gives `USERINFO`; a leading `[` gives `IP_LITERAL`; `:` gives `PORT`. Lowercase the host; a trailing dot gives `TRAILING_DOT`; a dotted-quad gives `IP_LITERAL`.
4. Host `admin.shopify.com` gives `ADMIN_STORE_URL`. A host ending in `.myshopify.com` whose prefix contains a dot gives `EXTRA_LABELS`. Any other host with a dot (custom domain, apex `myshopify.com`, lookalikes) gives `WRONG_SUFFIX`. A host without a dot is a bare handle.
5. Handle grammar [A, Q-R2]: `^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$` and no `xn--` prefix, else `INVALID_HANDLE`.
6. Path (URL form only): empty, a single slash, or the segment `admin` with optional further segments; otherwise `PATH`. Query and fragment are ignored.

Host checks run before the path check, so `https://evil.example/mystore.myshopify.com` is `WRONG_SUFFIX`, as the spec requires. The reason never includes the input.

### Ports

```ts
// stores/ports/shopify-gateway.port.ts
interface StoreConnection { readonly storeId: string; readonly shopDomain: ShopDomain;
  readonly apiVersion: string; readonly credentials: CredentialProvider }
interface GatewayRead<T> { readonly value: T; readonly apiVersionUsed: string | null }
interface ShopifyGateway {
  getShopInfo(c: StoreConnection): Promise<GatewayRead<ShopInfo>>;
  getGrantedScopes(c: StoreConnection): Promise<GatewayRead<string[]>>;
  listLocations(c: StoreConnection): Promise<GatewayRead<{ locations: Location[]; truncated: boolean }>>;
}   // every failure is a ShopifyGatewayError
// also: StoreRepository, CredentialVault (seal, open), CredentialProviderRegistry (forStore, forget), IdGenerator
```

### GraphQL client and classification

`ShopifyGraphqlClient.execute({ connection, query, variables, estimatedCost, retry })` builds the request (D11), headers `Content-Type` and `Accept: application/json` plus `X-Shopify-Access-Token` (the only place the token appears), waits the tracker advice, sends, classifies, observes `throttleStatus` when the cost block is well formed, then applies D15 and the forced refresh.

| Order | Signal | Kind | Basis |
|---|---|---|---|
| 1 | `fetch` rejected by the timeout or abort signal | `TIMEOUT` | [VS 2] error names |
| 2 | `fetch` rejected otherwise (DNS, refused, TLS, redirect refused) | `NETWORK` | only the classification survives |
| 3 | 401 | `AUTH_FAILED` | C9; body [A] |
| 4 | 402, 403, 423 | `SHOP_UNAVAILABLE` | S3 research source |
| 5 | 404 | `STORE_NOT_FOUND` | [A] for an unknown shop |
| 6 | 429 | `THROTTLED`, `retryAfterMs` from an integer `Retry-After` | C7; header [A] |
| 7 | 5xx | `SERVER_ERROR` | |
| 8 | other non-2xx | `GRAPHQL_ERROR` if JSON with non-empty `errors`, else `INVALID_RESPONSE` | |
| 9 | 2xx with wrong content type, over the cap, bad JSON, not an object, or neither `data` nor `errors` | `INVALID_RESPONSE` | |
| 10 | `errors[]` entry with code THROTTLED | `THROTTLED` (HTTP 200) | C6; body [A] |
| 11 | entry message contains "Invalid API key or access token" | `AUTH_FAILED` | research source S5; status and shape [A] |
| 12 | code ACCESS_DENIED (no `requiredAccess` needed) | `SCOPE_MISSING` | C8; shape [A] (C21 is not Admin evidence) |
| 13 | code SHOP_INACTIVE | `SHOP_UNAVAILABLE` | |
| 14 | code MAX_COST_EXCEEDED | `QUERY_TOO_COSTLY` | C5 |
| 15 | code INTERNAL_SERVER_ERROR | `SERVER_ERROR` | |
| 16 | any other `errors[]` | `GRAPHQL_ERROR` | |
| 17 | `data` fails the operation's zod schema | `INVALID_RESPONSE` | |

Rows 10 to 16 are checked across all entries in that order; no data is used when `errors` is non-empty. `AUTH_FAILED` triggers at most one `refreshAfterRejection` per operation; a `null` result (static token) or a second `AUTH_FAILED` ends the operation.

### Throttle tracker and cost declarations

`waitTimeFor` is 0 without state, else `ceil((cost - projected) / restoreRate · 1000)` when `projected = min(maximumAvailable, currentlyAvailable + restoreRate · elapsedSeconds)` is short of the cost. Hand-computed estimates [A against `requestedQueryCost`]: shop about 2, scopes about 2, a locations page of 50 about 52, all far below the 1,000-point cap (C4). One tracker per process.

### Queries (field names read on "latest" reference pages, [VS 7] against 2026-10)

- `shop { id name myshopifyDomain currencyCode plan { publicDisplayName partnerDevelopment shopifyPlus } }` (C16).
- `currentAppInstallation { accessScopes { handle } }` (C16); duplicates removed, order kept.
- `locations(first: 50, after: $after, includeInactive: false, includeLegacy: false) { nodes { id name isActive fulfillsOnlineOrders } pageInfo { hasNextPage endCursor } }`; arguments per C15; `nodes`, `isActive`, `fulfillsOnlineOrders`, page size and required scope are [VS 7] and [A]. Inactive entries are also filtered defensively.

### Client-credentials exchange

`ClientCredentialsExchanger` reuses the transport (fixed token URL, form body with `grant_type`, `client_id`, `client_secret` (C10), no access-token header, `redirect: 'error'`, 15 s, 2 MB). A 2xx body is parsed with zod (`access_token` non-empty, `expires_in` positive integer; `scope` optional; others ignored). Failures: network `NETWORK`, timeout `TIMEOUT`, 5xx `SERVER_ERROR`, 429 `THROTTLED`, anything else (including an unparseable 2xx) `CREDENTIAL_EXCHANGE_FAILED` with reason `SHOP_NOT_PERMITTED` when the capped body text contains `shop_not_permitted` (C11), else `UNKNOWN`. The body is discarded after that test. Statuses and bodies are [A] (Q-R5).

### Verification

1. Load the store (unknown: not-found error, no outbound call). Open the envelope; `CredentialsUnreadableError` becomes the problem `AUTH_FAILED` / `CREDENTIALS_UNREADABLE`, with no outbound call.
2. `getShopInfo`, `getGrantedScopes`, `listLocations` in order, with the config version (never the stored one). The first failure stops the sequence, except `SCOPE_MISSING` from `listLocations`, which adds `locations` to the missing set. Parts not obtained are empty as the spec states.
3. Missing capabilities: `write_<x>` also counts as `read_<x>`; a read never satisfies a write; `locations` is met by any of its three alternatives (Q7; the locations rule is [A]). One `SCOPE_MISSING` problem holds the union.
4. Any non-null `apiVersionUsed` different from the requested version adds `VERSION_UNSUPPORTED` / `API_VERSION_MISMATCH`.
5. Status precedence: auth family, then scope, then any other problem gives `UNAVAILABLE`, else `CONNECTED`.
6. Persist in one conditional update (D19): status, `lastVerifiedAt = checkedAt`, `shopifyShopId` when obtained, `apiVersion = used ?? requested`, snapshot without locations (only `locationCount`).

### HTTP layer

| Route | Method | Origin guard | Notes |
|---|---|---|---|
| `api/stores` | POST | yes | create `UNVERIFIED`, no outbound call (Q4) |
| `api/stores`, `api/stores/{id}` | GET | Host only | no decrypt, no write, no secret |
| `api/stores/{id}/verify` | POST | yes | outbound reads, 200 `StoreVerification` |
| `api/stores/{id}/credentials` | PUT | yes | new envelope, verification fields cleared, `forget(id)` |
| `api/stores/{id}` | DELETE | yes | hard delete (Q3), `forget(id)`, 204 |

Every route that calls out or changes state is non-GET, because the S0 guard skips the Origin rule for safe methods and a cross-site GET still runs. `CORS_ALLOWED_METHODS` already includes `PUT` and `DELETE`. The controller validates with contracts zod `safeParse` in the spec's precedence (shape, then domain, then credentials) and throws typed errors with fixed messages; zod issues are never returned or logged. A malformed `{id}` is answered exactly like an unknown one, before any repository call. Every response, including errors and 204, carries `Cache-Control: no-store` (set by the controller and by the filter). Note: body parsing runs before the guard, so a foreign-origin request with malformed JSON may receive 400 instead of 403; the handler still never runs.

## Data Flow

```
POST api/stores --guard--> StoresController --zod--> CreateStore
   parseShopDomain -> IdGenerator -> CredentialVault.seal (store:<id>:credentials) -> StoreRepository.insert

POST api/stores/{id}/verify --guard--> VerifyStoreConnection
   StoreRepository.findById -> CredentialVault.open -> CredentialProviderRegistry.forStore
   -> ShopifyGateway (HTTP) x3 -> ShopifyGraphqlClient
        -> ThrottleTracker.waitTimeFor -> ShopifyHttpTransport(fetchFn) -> classify -> RetryPolicy
        -> on AUTH_FAILED: CredentialProvider.refreshAfterRejection -> ClientCredentialsExchanger
   -> scope diff, version check, status -> StoreRepository.recordVerification (D19) -> 200
```

## File Changes

| File | Action | Description |
|---|---|---|
| `packages/contracts/src/{stores,store-verification,shopify-errors,shopify-scopes}.ts` (+ tests), `index.ts` | Create/Modify | D3 |
| `packages/contracts/src/api-error.ts`, `api-error.test.ts` | Modify | Five store codes |
| `apps/api/src/shared-kernel/time/{clock.port,system-clock}.ts` | Create | D9 |
| `apps/api/src/shared-kernel/secret-box/deferred-secret-box.ts` (+ test) | Create | D4 |
| `apps/api/src/stores/domain/**` | Create | Shop domain, store rules, payload types, scope diff, status mapping |
| `apps/api/src/stores/application/**` | Create | Six use cases, typed store errors, tokens |
| `apps/api/src/stores/ports/*.port.ts`, `shopify-gateway-error.ts` | Create | Gateway, repository, vault, provider, registry, id generator |
| `apps/api/src/stores/infrastructure/{credentials,gateway,persistence,simulator,http}/**`, `store-log-fields.ts` | Create | Adapters, client, tracker, retry, controller, filter |
| `apps/api/src/stores/test-support/**` | Create | Contract suite, scripted fetch, fixtures with provenance, canary helpers |
| `apps/api/src/stores/stores.module.ts` | Create | `forRoot(config, persistence, { secretBox, logger, overrides? })` |
| `apps/api/prisma/schema.prisma`, `prisma/migrations/<timestamp>_stores/migration.sql` | Modify/Create | D18 |
| `apps/api/src/persistence/{prisma.service,expected-tables}.ts` | Modify/Create | Expected-table check |
| `apps/api/src/persistence/test-support/apply-migrations.ts` | Create | Applies every committed migration in order |
| `persistence/{baseline-migration,prisma-key-check-store}.int.test.ts`, `key-boot.int.test.ts`, `main.int.test.ts`, `health/health.int.test.ts` | Modify | Use the helper (they apply only the baseline today and would fail the new check); baseline test expects two migrations and three tables |
| `apps/api/src/main.ts`, `app.module.ts`, `local-security/no-test-route-ships.test.ts` | Modify | D4, wiring |
| `eslint.config.js` | Modify | D2 |
| `README.md` | Modify | Limitations and verification status |

Migration (names per `persistence-baseline`): table `store` with `id TEXT PRIMARY KEY`, `display_name TEXT NOT NULL`, `shop_domain TEXT NOT NULL`, `shopify_shop_id TEXT`, `api_version TEXT`, `auth_kind TEXT NOT NULL`, `credentials_envelope TEXT NOT NULL`, `status TEXT NOT NULL`, `last_verified_at DATETIME`, `last_verification TEXT`, `created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, `updated_at DATETIME NOT NULL`, plus `CREATE UNIQUE INDEX store_shop_domain_key ON store(shop_domain)`. The SQL is generated by Prisma and committed; `auth_kind` and `status` are plain `String` validated by the mapper.

## Testing Strategy

Strict TDD; no network in CI because every outbound path takes `fetchFn`.

| Layer | What | Approach |
|---|---|---|
| Unit | Shop domain (every reason code and accepted form), scope diff, status mapping, tracker math, retry waits and counts, `'none'` and undeclared retry, token cache (margin edges, five concurrent callers, shared failure, forced refresh once), `DeferredSecretBox` (unbound, double bind, delegate), log field names | Tables with fake `Clock`, recorded `sleep` calls, fixed `random` |
| Int | Classification table | One case per row with a scripted `fetchFn`; the cause-chain canary case; rejected domains never reach `fetchFn` |
| Int | Gateway contract suite | One parameterized suite over the simulator and the HTTP adapter with fixtures; equal values and equal kinds for the spec's case list |
| Int | Persistence | Migration upgrade and fresh apply, unique index, repository mapping, duplicate race mapped to already-exists, D19 conditional update, expected-table check |
| Int | HTTP | Ephemeral port: statuses, `no-store` on every response, foreign Origin and cross-site `Sec-Fetch-Site` on the four write routes give 403 with zero handler, repository and gateway calls, GET with foreign Origin returns no secret, malformed JSON [VS 9] |
| Int | No-leak canaries | Distinct canaries for a static token, client secret, exchanged token, an `shpat_` hex string and a Bearer string, through create, verify (success and every kind), replace and delete; scan the logger sink at `debug`, response bodies and headers, thrown errors (message, own properties, full cause chain), and the raw bytes of the database file and its WAL; a swapped envelope is unreadable |

Fixtures live in `stores/test-support/fixtures/`; each declares `provenance` (all S2 fixtures: `hand-authored-from-documentation`), a source claim or URL and an assumption note, and a test rejects a missing or `recorded` tag. What cannot be verified here: real bodies and statuses for throttling, access denied, bad token and version fall-forward; client-credentials errors; scope strings; plan values; `locations` limits and scope; rename redirects; query costs.

## Threat Matrix

N/A for every row (documentation-like paths, git repository selection, commit state, push state, PR commands): S2 has no shell, subprocess, VCS or PR automation, or executable-file classification. Its boundaries are inbound HTTP routes and outbound HTTPS; they are covered by the origin guard (side effects only on non-GET routes), the shop domain guard with fixed URL construction and redirect refusal, transport caps, and the canary suite.

## Migration / Rollout

Additive second migration. Every test that applied only the baseline moves to the helper in the same unit. Rollback per the proposal: revert the chain, then drop table `store` or delete the local database file; the key file and `app_setting` are untouched.

README edits (documentation only): no local API authentication, so any local process can create, replace or delete store credentials and only the Host and Origin guards apply; the redactor's set of secret values grows during the process life; nothing was verified against a real store, with the unverified items listed and the smoke test planned for S7; the key file backup now protects real credentials.

## Delivery Units (hand-written lines, about 35 percent uncertainty)

| Unit | Content | Est. | After |
|---|---|---|---|
| U1 | Contracts and `ApiError` codes and test | ~300 | none |
| U2 | Lint (D2), shop domain guard, store rules, payload types, scope diff, status mapping, `CredentialProvider` port type, `Clock` port | ~360 | U1 |
| U3 | Prisma model, migration, apply-migrations helper and the test edits, expected-table check, repository port and adapter | ~380 | U2 |
| U4 | `DeferredSecretBox`, boot binding, `AppModule` option, vault with context and registration, static provider | ~340 | U2 |
| U5a | Exchanger and its classification | ~220 | U4, U7a |
| U5b | Token cache, single-flight, forced refresh, registry and `forget` | ~240 | U5a |
| U6a | Gateway port, `StoreConnection`, `ShopifyGatewayError` | ~180 | U2 |
| U6b | Simulator with fault injection | ~240 | U6a |
| U7a | URL builder, transport (redirect, timeout, cap, content type, parse) | ~230 | U6a |
| U7b | Classification table, version header, cost extraction | ~230 | U7a |
| U8 | Tracker, retry policy, forced-refresh attempt | ~300 | U7b, U4 |
| U9a | Queries, zod response schemas, fixtures with provenance | ~240 | U8 |
| U9b | HTTP gateway operations, locations paging, sort and cap | ~200 | U9a |
| U10 | Gateway contract suite | ~260 | U6b, U9b |
| U11 | `VerifyStoreConnection` and D19 | ~340 | U3, U5b, U10 |
| U12 | Create, list, get, replace, delete use cases | ~330 | U3, U4, U5b |
| U13a | Controller, filter, module, `AppModule` wiring, route test edit | ~260 | U11, U12 |
| U13b | HTTP integration tests and the D21 decision | ~220 | U13a |
| U14 | Canary suite, log field test, README | ~280 | U13b |

About 5,150 lines in 19 units. U5, U6, U7, U9 and U13 are pre-split; U3 is the next candidate if the test edits run long. Order changes against the proposal: U6a follows U2 (it needs `ShopDomain` and the provider port type); U5a needs the transport of U7a; U8 needs U4.

## To Verify (VS)

| # | Item | Unit |
|---|---|---|
| 1 | Node 24 `fetch` with `redirect: 'error'` rejects on a 3xx without contacting the target | U7a |
| 2 | `AbortSignal.timeout` and abort error names under Vitest; an injected `timeoutSignal` aborts mid-body | U7a |
| 3 | Byte-counting body reader cancels the stream at the cap and accepts exactly 2,097,152 bytes | U7a |
| 4 | Prisma 7 `migrate deploy` applies the second migration on SQLite over a baseline database; `migrate diff` against the schema is empty | U3 |
| 5 | A unique violation through the better-sqlite3 adapter surfaces as `P2002` | U3 |
| 6 | Nest `useValue` keeps the same `DeferredSecretBox` instance that boot binds after `NestFactory.create` | U4 |
| 7 | Field and argument names of the three queries on the 2026-10 reference pages (`nodes`, `isActive`, `fulfillsOnlineOrders`, `ShopPlan` fields, `accessScopes.handle`) | U9a |
| 8 | zod parse of the three response shapes from fixtures, including empty `nodes` and multi-page cursors | U9a |
| 9 | Whether a body-parser error reaches a controller-scoped filter, what it logs, and the `bodyParser: false` fallback (D21) | U13b |
| 10 | Prisma and undici failure messages carry no parameter values (canary suite plus D20) | U14 |

Real-store assumptions [A] (S7 smoke test): THROTTLED, ACCESS_DENIED and 401 bodies; `Retry-After`; 404 for an unknown shop; fall-forward status and body; handle grammar and rename redirects; client-credentials statuses and bodies; `locations` page size and scope; granted scope strings; plan values; query costs.

## Open Questions

None blocks tasks.

- [ ] Escalation: `store-endpoints` requires "the enumeration tests in contracts and in the web package" to list the new codes, but `apps/web` has no such test. Design: no web change; the spec sentence should drop the web half, or tasks add nothing there.
- [ ] Escalation: no `ApiError` code exists for an unexpected 500 on store routes; D20 answers Nest's generic 500 body. Confirm, or add a code to the spec.
- [ ] Not adopted: a check that `shop.myshopifyDomain` equals the stored domain. The spec has no problem kind for it and the fixed URL makes a different shop unlikely; S4 may revisit.
