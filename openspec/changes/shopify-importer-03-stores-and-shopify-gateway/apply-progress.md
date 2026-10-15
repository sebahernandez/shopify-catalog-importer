# Apply progress: shopify-importer-03-stores-and-shopify-gateway

## U1a Contracts: scopes, error kinds and store verification (1.1 to 1.5, 1.10, 1.11)

Branch: feat/stores-u1a-scopes-errors-verification (from develop at d24d3e6). Strict TDD, Node 24, pnpm via corepack. U1 was written in one piece (542 hand-written lines against about 300 planned) and split in two by maintainer decision on 2026-10-14: U1a (this unit: shopify-scopes, shopify-errors, store-verification) and U1b (stores, the five ApiError codes, the remaining index exports; tasks 1.6 to 1.9 and 1.12 to 1.15). The import chain is shopify-errors, then store-verification, then stores, which is why this cut is clean.

### Task 1.1 record (no file edit)

- The delta specs win over the design on codes and wording. The five ApiError messages are fixed by the store-endpoints spec and are not in contracts: contracts carry codes only, and the API unit that throws them owns the text.
- apps/web has no ApiError enumeration test (its only mention is one HOST_NOT_ALLOWED fixture), so no web file changes. The store-endpoints spec sentence about the web package enumeration is moot, and the spec was corrected in the planning PR.
- No ApiError code exists for an unexpected 500. Nest's generic 500 body is the answer (design D20), the same as S0's local-request.filter.ts.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 1.2 and 1.3 | Suite failed: cannot find module for shopify-scopes | 4 tests pass | Constants frozen; LOCATIONS_ALTERNATIVES exported next to REQUIRED_CAPABILITIES. |
| 1.4 and 1.5 | Suite failed: cannot find module for shopify-errors | 17 tests pass | 13 kinds, isRetryableKind, exchange failure reasons. |
| 1.10 and 1.11 | Suite failed: cannot find module for store-verification | 14 tests pass | Done before the stores schemas, because the store summary embeds the snapshot schema. |

### Measured hand-written lines

Code: shopify-scopes 16, shopify-errors 30, store-verification 72, index +9 (exports of these three modules) = 127. Tests: shopify-scopes 32, shopify-errors 37, store-verification 111 = 180. Total 307. Nothing was trimmed.

### Deviations and decisions for later units

- VerificationProblem enforces that code equals kind, except the two special codes, each tied to its kind: API_VERSION_MISMATCH with VERSION_UNSUPPORTED, and CREDENTIALS_UNREADABLE with AUTH_FAILED. The task asked for the two special codes and did not ask for the kind tie.
- Timestamps use z.iso.datetime() (UTC Z only, offsets rejected).
- Extra exports beyond the task list: LOCATIONS_ALTERNATIVES, Capability, ExchangeFailureReason.

## U1b Contracts: stores, credentials and ApiError codes (1.6 to 1.9, 1.12 to 1.15)

Branch: feat/stores-u1b-stores-contracts (from develop at eaf0a8f, after U1a). Strict TDD, Node 24. Second of the two parts of U1; the code was written and verified together with U1a and split afterwards, so the RED observations below were made in the combined run.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 1.6 and 1.7 | Suite failed: cannot find module for stores | 12 tests pass | Strict payloads, trim then 1 to 512 characters, secrets minimum 8, extra fields rejected. |
| 1.8 and 1.9 | stores tests failed (new exports undefined) | 17 tests pass | The summary imports the snapshot schema from store-verification (U1a). |
| 1.12 and 1.13 | 5 new api-error cases failed (the enum rejected the new codes) | 14 tests pass | STORE_NOT_FOUND, STORE_DOMAIN_INVALID, STORE_ALREADY_EXISTS, STORE_CREDENTIALS_INVALID, STORE_REQUEST_INVALID. |
| 1.14 | n/a | web 193 tests pass | No web file edited; the closed enum change breaks nothing there. |

### Measured hand-written lines

Code: stores 77, api-error +5, index +11 = 93. Tests: stores 85, stores-credentials 52, api-error test +5 = 142. Total 235. Nothing was trimmed.

### Deviations and decisions for later units

- CreateStoreBody.domain is a plain string: the domain guard in the API owns its validation and its reasons. shopDomain and displayName in the summary are plain strings.
- displayName counts code points with a refine, because zod max counts UTF-16 units and an 80-emoji name would otherwise fail.
- Extra exports beyond the task list: AuthKind, StoreStatus.
- The U1 total across both parts is 542 hand-written lines (307 in U1a and 235 in U1b), against about 300 planned: the store-verification suite and prettier wrapping of long test expectations were the main drivers.

## U2a Lint, clock and shop domain guard (2.1 to 2.8)

Branch: feat/stores-u2a-shop-domain-guard (from develop at e23b92e, after U1a and U1b). Strict TDD, Node 24. U2 was written in one piece (490 hand-written lines against about 360 planned) and split in two by maintainer decision on 2026-10-15 at the pre-agreed cut after 2.8: U2a (this unit: lint purity block, Clock port and SystemClock, the shop domain guard) and U2b (scope diff, verification status, store record and rules, the CredentialProvider port type; tasks 2.9 to 2.16).

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 2.1 and 2.2 | Negative gate: a temporary file importing node:net failed lint naming the import | Temporary file deleted, confirmed gone | OTHER_MODULES gains stores; new purity block for stores domain and application. |
| 2.3 and 2.4 | Suite failed: cannot find module for system-clock | 2 tests pass | Clock port and SystemClock under shared-kernel/time. |
| 2.5 and 2.6 | Suite failed: cannot find module for shop-domain; then 1 of 23 failed (PATH for a foreign URL path) | 23 tests pass | Own authority parser, no URL, no node imports. |
| 2.7 and 2.8 | 22 of 27 failed before steps 4 to 6 | 27 pass (50 in stores) | Suffix is one constant. |

### Measured hand-written lines

Code: eslint 13, clock port 4, SystemClock 8, shop-domain 83 = 108. Tests: system-clock 17, shop-domain-syntax 39, shop-domain-host 62 = 118. Total 226. Nothing was trimmed.

### Security review by the orchestrator

The shop domain guard source was read line by line against hostile inputs: schemes other than http and https fall to PATH, myshopify.com.evil.example, evilmyshopify.com and the apex give WRONG_SUFFIX, userinfo, ports, IPv4 and IPv6 literals and a trailing dot are rejected before the handle is looked at, the handle regex is anchored and xn-- handles are refused, and a path such as admin followed by an at sign cannot change the host because the host comes from the authority cut at the first slash. No gap was found.

### Deviations and decisions for later units

- The 2.5 table row for PATH on a pasted URL with a foreign path needs the path rule, so the path check was added in 2.6 after the authority checks and 2.8 inserted the host checks before it (host first, as the spec requires).
- The input my store (embedded space) is rejected with WHITESPACE (step 1), not INVALID_HANDLE; the spec only requires rejection.
- The pre-agreed cut after 2.8 was not triggered by the size threshold (running total about 226), but the maintainer chose to split there anyway because the cut is clean and the guard is the security piece.

## U2b Scope diff, verification status and store rules (2.9 to 2.16)

Branch: feat/stores-u2b-store-rules (from develop at 24f3d86, after U2a). Strict TDD, Node 24. Second of the two parts of U2; the code was written and verified together with U2a and split afterwards, so the RED observations below were made in the combined run.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 2.9 and 2.10 | Suite failed: cannot find module for scope-diff | 4 tests pass | Write includes read; locations met by any of the three alternatives; missing follows the order of the required capabilities; granted kept verbatim. |
| 2.11 and 2.12 | Suite failed: cannot find module for verification-status | 15 tests pass | Authentication outranks scope outranks unavailable; CONNECTED if and only if there is no problem. |
| 2.13 and 2.14 | Suite failed: cannot find module for store-rules | 4 tests pass | New store UNVERIFIED with the four verification fields null; replacing credentials resets them and never moves updatedAt earlier. |
| 2.15 | n/a | typecheck and lint pass | Type-only CredentialProvider port: authKind, accessToken(), refreshAfterRejection(rejected). |
| 2.16 | n/a | pnpm check exit 0: contracts 263, web 193, api 3437 tests | |

### Measured hand-written lines

Code: scope-diff 29, verification-status 10, store 18, credentials-payload 13, store-rules 39, credential-provider port 9 = 118. Tests: scope-diff 31, verification-status 42, store-rules 73 = 146. Total 264. Nothing was trimmed. U2 across both parts is 490 hand-written lines (226 in U2a and 264 in U2b) against about 360 planned: the exhaustive shop domain tables and the 73-line store-rules test were the main drivers.

### Deviations and decisions for later units

- The Store record includes credentialsEnvelope; replaceCredentials takes authKind and the new envelope plus the time. Domain payload types are plain interfaces (no zod).
- The CredentialProvider port is type only; its adapters arrive in U4 and U5a.

## U3a Persistence, migration helper, expected-table check (3.1 to 3.12)

Branch: feat/stores-u3-persistence (from develop at b08886d, after U1a, U1b, U2a, U2b). Strict TDD, Node 24. Stopped at the pre-agreed cut after 3.12: the running total measured 317 hand-written lines (above the about 280 threshold), and the repository (3.13 to 3.15) would have pushed the unit well past 400. Tasks 3.13 to 3.16 are left unticked for a second part (U3b).

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 3.1 and 3.2 | Suite failed: cannot find module apply-migrations | 3 tests pass | Helper runs prisma migrate deploy with DATA_DIR and HOME inside the sandbox; baselineOnly runs it against a copy of the schema with the baseline migration alone. |
| 3.3 and 3.4 | 6 of 10 failed (no second migration, no store table) | 13 pass with the helper tests | Model Store mapped to store, migration folder 20261015120000_stores. |
| 3.6 and 3.7 | Expected-tables suite: cannot find module; then 1 of 18 service tests failed (a baseline-only database was accepted) | 18 pass | connect() checks every table of EXPECTED_TABLES with one IN query. |
| 3.8 | The four existing int tests applied the baseline only and failed with MIGRATION_REQUIRED (message: The database has not been migrated yet): prisma-key-check-store 12 of 12 failed, key-boot 6 of 24, main 22 of 41 (9 skipped), health 28 of 29 | See 3.9 to 3.12 | Run 68 failed, 36 passed, 9 skipped in total. |
| 3.9 to 3.12 | n/a | CP1: the four tests pass through the shared helper; src/persistence, key-boot, main and health: 11 files, 157 tests pass | |

### VS4 (migrate deploy over a baseline database, and empty migrate diff)

All commands ran with env -i, PATH of the Node 24 install, HOME and DATA_DIR inside a temporary scratch folder, cwd apps/api.

- Generation: a sandbox database was created from the baseline SQL, then `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` printed only a CreateTable for store and a CreateIndex store_shop_domain_key (unique on shop_domain). That output is the committed migration.sql (18 lines, no other statement).
- Deploy: `prisma migrate deploy` on an empty sandbox applied 20261013180211_baseline and 20261015120000_stores, ending with All migrations have been successfully applied; a second run printed No pending migrations to apply. The upgrade path (baseline first, an app_setting row, then the second migration) is covered by the baseline-migration int test.
- Diff: `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` against the migrated sandbox printed No difference detected and exited 0.

### Measured hand-written lines (added lines)

Code: schema 20, helper 65, expected-tables 2, prisma.service 6 = 93. SQL: 18. Tests: apply-migrations 60, expected-tables 8, baseline-migration 95, prisma.service 33, key-check store 2, key-boot 2, main 3, health 3 = 206. Total 317 (the four moved tests also delete 51 lines, the baseline test 56 and the service test 19). Nothing was trimmed.

### Deviations and decisions for later units

- The helper signature is applyMigrations(sandbox, { baselineOnly }) with the database in sandbox/data and HOME in sandbox/home (every caller already uses that layout); committedMigrations() is exported with it.
- prisma.service.int.test.ts also uses the helper (its previous direct SQL run read only the first migration folder). Each of those tests now spawns the Prisma CLI (about 0.4 s each).
- created_at and updated_at have a CURRENT_TIMESTAMP default in the model and no automatic update on write: the repository sets them explicitly, so replace never moves updatedAt earlier.
- Open for U3b: tasks 3.13 to 3.16 (repository port, VS5, adapter, mapper) and the unit gate.

## U3b Store repository port, adapter and mapper (3.13 to 3.16)

Branch: feat/stores-u3b-repository (from develop at f7727f2, after U3a). U3 was delivered in two parts: U3a (3.1 to 3.12, 317 lines) and U3b (3.13 to 3.16). Strict TDD, Node 24.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 3.13 | n/a (type-only port plus the error class) | typechecked with the adapter | Port: insert, findById, list, replaceCredentials(id, next), delete; replace returns the store or null, delete returns a boolean. |
| 3.14 and 3.15 | The int suite failed to load: cannot find module prisma-store-repository.js | 10 of 10 pass | One test case needed a fix of the test itself (single-letter shop names are not valid domains), not of the code. |
| 3.16 | n/a | Focused command: 12 files, 167 tests pass | pnpm check exit 0: contracts 263, web 193, api 3457 tests. |

### VS5 (unique violation through the better-sqlite3 adapter)

Confirmed. Two creates of one shop_domain through PrismaService (migrated sandbox) made the second reject with PrismaClientKnownRequestError, code P2002, driver cause SQLITE_CONSTRAINT_UNIQUE (UNIQUE constraint failed: store.shop_domain), kind UniqueConstraintViolation. The repository maps exactly that code to DuplicateShopDomainError. The throwaway probe test was deleted.

### Measured hand-written lines

Code: port 25, repository 93, mapper 57 = 175. Tests: int test 174. Total 349 (U3a was 317, so U3 is 666 across both parts). Nothing was trimmed.

### Deviations and decisions for later units

- The repository takes (PrismaService, Clock, LoggerPort). replaceCredentials reads the Clock, applies the domain rule, and writes updatedAt explicitly; insert writes the dates of the Store given.
- Every non-unique driver error is replaced by a fixed message with no cause, because Prisma errors can quote bound values such as the envelope. The mapper rejects an unknown status or auth_kind with a fixed message, and a corrupt last_verification yields the single warning event store.last_verification.corrupt with no fields.
- Replace is a read then an update (no transaction); a concurrent delete between them would surface as the generic failure.
- Isolation: every test database lives in a temporary sandbox through the shared helper. No data directory, key file or db file exists in the repository, and the real home has no importer folder.

## U4 SecretBox binding, vault, static provider (4.1 to 4.10)

Branch: feat/stores-u4-secretbox-vault (from develop at c594517, after U1 to U3). Strict TDD, Node 24. All ten tasks delivered in one part; the pre-agreed cut after 4.5 was not needed (running total 198 after 4.5).

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 4.1 and 4.2 | Suite failed: cannot find module deferred-secret-box | 4 tests pass | KEY_MISSING before bind, a second bind throws KEY_MISSING with a fixed message, delegate resolved on every call. |
| 4.3 | n/a (verification) | 1 test passes | See VS6 below. |
| 4.4 and 4.5 | 2 of 3 failed: the options passed to AppModule.forRoot had no secretBox (undefined) | 3 pass; main, local-security and secret-box suites 15 files, 2366 tests pass | The third test (mismatch never binds) passed before the code because nothing bound anything yet; it guards the ordering. |
| 4.6 and 4.7 | Suite failed: cannot find module credentials-unreadable.error | 4 tests pass | One envelope per store, context store:lowercase id:credentials. |
| 4.8 and 4.9 | Suite failed: cannot find module static-token-provider | 2 tests pass | A typecheck error in the test (the class method takes no argument) was fixed by typing the instance as the port. |
| 4.10 | n/a | Focused command: 8 files, 224 tests pass; pnpm check exit 0: contracts 263, web 193, api 3471 tests | Check first failed on lint (see deviations), then passed. |

### VS6 (Nest useValue keeps the holder that boot binds later)

Confirmed. A minimal module provides one DeferredSecretBox with useValue under a Symbol token and a consumer injects it. After NestFactory.createApplicationContext, the consumer holds the same instance (toBe), a call before bind throws, and after bind the consumer encrypts and decrypts through the bound box. The same-instance guarantee is also exercised by main.int.test.ts, where the spy on AppModule.forRoot sees the holder that is later bound.

### AppModule.forRoot callers edited

- apps/api/src/main.ts (production caller): passes secretBox.
- apps/api/src/local-security/no-test-route-ships.test.ts (the only other caller, found with rg): passes a RedactingLogger with a no-op sink and a new DeferredSecretBox. The expected import count (five) and controllers are unchanged, because StoresModule arrives in U13a.

### Measured hand-written lines

Code: deferred-secret-box 34, main.ts 9, app.module.ts 5, eslint.config.js 2, credential-vault port 10, unreadable error 11, vault 45, static provider 17 = 133. Tests: deferred unit 59, VS6 int 39, main.int 46, no-test-route-ships 7, vault 79, static provider 24 = 254. Combined 387 (budget 400, planned 340). Nothing was trimmed.

### Deviations and decisions for later units

- The VS6 test uses NestFactory.createApplicationContext, because @nestjs/testing is not a dependency and none was added. A rule in eslint.config.js bars NestJS imports in the kernel, so the kernel block ignores that one test file by name (two lines).
- The boot test seam is BootstrapOptions.secretBox (a DeferredSecretBox). bootstrap() creates its own when none is passed. The "decrypted canary" case is proved by decrypting, through the bound holder, an envelope made with a box over the seeded key, plus the existing proof that every form of that key is redacted.
- A second bind throws SecretBoxError KEY_MISSING (the code set has no better fit); use before bind is KEY_MISSING, as the task says.
- The vault port is synchronous (the SecretBox is). seal takes the domain payload and stores only its fields (no kind); open takes the authKind read from the row and validates with the contracts schema (strict, so an extra or missing field is unreadable). seal encrypts first and registers afterwards, so an unbound box registers nothing.
- AppModule does not consume secretBox yet: StoresModule.forRoot, which provides it under SECRET_BOX, arrives in U13a.

### U4 harness (checkpoint CP2, run by the orchestrator)

Booted from a temporary clone of the branch (commit 60ab17f) under the session scratch directory, never from the real repository or the real HOME: env -i with HOME, DATA_DIR and SECRET_KEY_FILE inside the temporary directory (key directory mode 700), loopback 127.0.0.1, port 39519, migrated with prisma migrate deploy in the same isolated environment. Results: health 200 with shopifyApiVersion 2026-10, the template route 200, the generated key file has mode 0600, and the only warning logged was the expected key_file_generated event. The process was stopped and the temporary directory removed; no repo process, data directory, key file or database file remained in the real repository, and the real HOME has no importer folder. This confirms the boot order after the change in main.ts: the holder is created before the application, and bound after reconcileKey and registerKeyring with the same keyring.

## U6a Gateway port and typed error (5.1 to 5.5)

Branch: feat/stores-u6a-gateway-port (from develop at def998c, after U1 to U4). Strict TDD, Node 24. All five tasks delivered.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 5.1 / 5.2 | Test run failed on the missing module shopify-gateway-error.js (no tests ran) | 19 tests pass after the class; two further REDs were real assertion failures (own keys listed undefined reason and name) | Optional fields are declared with the declare modifier so an absent reason is not an own key; name stays an own key, as in the other error classes |
| 5.3 / 5.4 | pnpm typecheck failed with TS2554 and TS2344 errors (module not found, expected types unresolved) | pnpm typecheck passes | The type test is checked only by typecheck |

Type-level RED check after GREEN: three temporary mutations of the port, each reverted, each made tsc fail in the port test: shopDomain typed as string, an extra member added to ShopifyGateway, and apiVersionUsed typed without null. Final tsc: clean.

### Measured hand-written lines

Code: shopify-gateway-error 44, shopify-gateway.port 44 = 88. Tests: error test 61, port type test 40 = 101. Combined 189 (budget 400, planned 180). Nothing was trimmed.

### Gate

pnpm check exit 0. Tests: contracts 263, web 193, api 3493.

### Deviations and decisions for later units

- The retryable set comes from the contracts helper isRetryableKind (THROTTLED, SERVER_ERROR, NETWORK, TIMEOUT); it matches task 5.1, so no discrepancy.
- The constructor is (kind, details) with details holding optional retryAfterMs and reason; a reason on any kind other than CREDENTIAL_EXCHANGE_FAILED throws a TypeError.
- ShopInfo fields follow the spec: id, name, myshopifyDomain, currencyCode, planName, shopifyPlus, partnerDevelopment.

## U6b Simulated gateway with fault injection (6.1 to 6.5)

Branch: feat/stores-u6b-simulator (from develop at 2772f79, after U1 to U4 and U6a). Strict TDD, Node 24. All five tasks delivered.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 6.1 / 6.2 | Run failed on the missing module simulated-shopify-gateway.js (no tests ran) | 9 tests pass | The source-purity test first covered only the gateway file; simulator-faults.ts was added to its list when the file existed |
| 6.3 / 6.4 | 12 of 12 fault tests failed with TypeError reading on of undefined (no faults member) | 21 simulator tests pass | Lint then forced two reshapes of the private run helper (no unnecessary assertion, no non-Error rejection, no async without await) |

### Fault-injection API

- gateway.faults.on(operation, callNumber, fault): fault only that 1-based call of that operation (counts are per operation, and failed calls count).
- gateway.faults.always(operation, fault): fault every call of the operation.
- Fault shapes: kind alone for AUTH_FAILED, SCOPE_MISSING, NETWORK, TIMEOUT, SERVER_ERROR, INVALID_RESPONSE; THROTTLED takes an optional retryAfterMs; VERSION_UNSUPPORTED takes an optional apiVersionUsed (default 2099-01) and makes the call succeed with that version.
- gateway.calls lists the operation names in call order; addShop(domain, shop) registers a shop keyed by canonical ShopDomain.
- Faults are applied before the unknown-domain check.

### Measured hand-written lines

Code: simulated-shopify-gateway 83, simulator-faults 66 = 149. Tests: gateway test 117, faults test 103 = 220. Combined 369 (budget 400, planned 240). Nothing was trimmed.

### Gate

pnpm check exit 0 (after a Prettier write on the faults test). Tests: contracts 263, web 193, api 3514.

### Deviations and decisions for later units

- The port and error type were not touched.
- Public methods log the call and apply faults after one microtask, so the log order is call order but not synchronous with the call.
- The fall-forward version defaults to a fixed constant (2099-01), which is never equal to a real requested version; a test or the contract suite can set another through the fault.

## U7a URL builder and transport, part 1 (7.1 to 7.5)

Branch: feat/stores-u7a-transport (from develop). Strict TDD, Node 24. Tasks 7.1 to 7.5 delivered. Tasks 7.6 to 7.9 NOT started: stopped at the pre-agreed cut after 7.5 because the transport (tests plus code, planned about 230 lines) would take the unit to about 520 lines against the 400 budget. The unit needs a second part (7.6 to 7.8) and then the 7.9 gate on its own.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 7.1 / 7.2 | Run failed on the missing module scripted-fetch.js (no tests ran) | 6 tests pass | Steps: response, streamed chunks (with hangAfter), throws, never. Calls record url, method, lowercased headers, body, init, pulledBytes and cancelled |
| 7.3 (VS1) | Not applicable (verification) | 1 test passes | See VS1 |
| 7.4 / 7.5 | Run failed on the missing module shopify-request.js (no tests ran) | 9 tests pass | Lint and typecheck forced small reshapes of scripted-fetch (exactOptionalPropertyTypes, promise-reject-errors) |

### VS1 result

Two real loopback servers on 127.0.0.1 with ephemeral ports. Node 24 fetch with method POST and redirect error, against a server answering 302 with a location pointing at the second server, rejects with a TypeError, and the second server received 0 requests. Recorded in redirect-refusal.int.test.ts.

### VS2 result

Observed under Vitest on Node 24.21.0: `AbortSignal.timeout(5)` aborts with a DOMException named `TimeoutError`; a manual `AbortController.abort()` gives `AbortError`. The transport classifies both names as TIMEOUT (any other failure is NETWORK). An injected `timeoutSignal` that aborts while the fetch never resolves gives TIMEOUT, and one that aborts mid-body (second chunk hanging) also gives TIMEOUT. Real `AbortSignal.timeout` through the transport also gives TIMEOUT.

### VS3 result

`readCappedBody` counts bytes per chunk. A body of exactly 2,097,152 bytes is read and parsed (pulledBytes = 2,097,152, stream not cancelled). With a stream of 40 chunks of 65,536 bytes where chunk 32 carries one extra byte (total crosses the cap at 2,097,153), the body is flagged OVERSIZE, the stream is cancelled, and pulledBytes stays within the cap plus one chunk and well below the full 40 chunks.

### TDD evidence (7.6 / 7.7)

RED: run failed on the missing modules (no tests ran). GREEN: shopify-http-transport.test.ts 13 tests pass; gateway plus test-support focused run 4 files, 29 tests pass.

### Transport shape (for U7b)

`createShopifyHttpTransport({ fetchFn, timeoutSignal? }).post(request, { headers, body })` returns `{ status, headers: Headers, body }` where body is `{ kind: 'json', value }` or `{ kind: 'flagged', reason: 'OVERSIZE' | 'NOT_JSON' | 'UNPARSEABLE' }`. It throws only ShopifyGatewayError TIMEOUT or NETWORK (no cause), plus a TypeError for a forged request before fetch. Limits live in transport-limits.ts (REQUEST_TIMEOUT_MS, MAX_BODY_BYTES).

### U7a gate (7.9)

Part 2 hand-written lines: transport 70, capped-body-reader 33, transport-limits 5 (code 108) plus test 178 = 286. Unit total with part 1 (289) is about 575 against a budget of 400 and a plan of about 280: OVERRUN of about 175 lines over budget, driven mostly by the 13-case transport test (178). Nothing was trimmed. Focused tests: 4 files, 29 tests pass. pnpm check exit 0 on Node 24.21.0 (contracts 263, web 193, api 3543). Note: the shell default was Node 22, which breaks better-sqlite3 (NODE_MODULE_VERSION 127 vs 137); the repo requires Node >= 24.

### Design notes

- shopify-request.ts holds the private brand plus a WeakSet of issued requests; issueShopifyRequest is meant to be called only by shopify-urls.ts, and isShopifyRequest is the run-time check the transport must call before fetch.
- shopifyUrls.graphql(domain, version) and shopifyUrls.token(domain) re-parse the domain at run time (it must parse to itself) and return a frozen request with a url member.
- The version pattern was not duplicated: API_VERSION_PATTERN is now exported from config env.schema.ts and used by both the config schema and the URL builder (3 added lines, 1 changed in env.schema.ts). The pattern only admits quarterly releases (01, 04, 07, 10), so 2026-05 and latest are refused.
- The scripted fetch signature is (url, init) returning a Response; the transport must use fetchFn with that shape.

### Measured hand-written lines

Code: scripted-fetch 75, shopify-request 20, shopify-urls 22, env.schema.ts change +3/-1 = 120. Tests: scripted-fetch test 77, redirect-refusal int test 36, shopify-urls test 56 = 169. Combined about 289 (budget 400, planned about 280 for the whole unit). Nothing was trimmed.

### Gate (partial, not the 7.9 gate)

Focused command (gateway and test-support): 3 files, 16 tests pass. pnpm check exit 0. Tests: contracts 263, web 193, api 3530.

## U5a Client-credentials exchanger (Phase 8, tasks 8.1 to 8.5)

Branch `feat/stores-u5a-client-credentials-exchanger`. All five tasks done.

### What was built

- `createShopifyHttpTransport(...).postForm(request, fields)`: form POST with `content-type: application/x-www-form-urlencoded` and a url-encoded string body; delegates to `post`, so redirect refusal, the 15 s signal and the TIMEOUT/NETWORK-only throws are unchanged.
- `createClientCredentialsExchanger({ transport, now }).exchange({ domain, clientId, clientSecret })` returns `{ accessToken, expiresAtMs }` (`now() + expires_in * 1000`). The token is registered with `registerSecret` before return. Zod accepts `access_token` non-empty and `expires_in` positive integer; other fields (including `scope`) are ignored.
- Failures: 5xx `SERVER_ERROR`, 429 `THROTTLED`, NETWORK and TIMEOUT from the transport, everything else (non-2xx, unparseable, non-JSON, bad shape) `CREDENTIAL_EXCHANGE_FAILED` with reason `SHOP_NOT_PERMITTED` when the body text contains `shop_not_permitted`, else `UNKNOWN`. Errors are the fixed-message `ShopifyGatewayError` with no cause.

### TDD evidence

RED: transport test (1 failing) and both exchanger suites failed on the missing module. GREEN: focused run 3 files, 27 tests pass. After the first GREEN run one test used an `shpat_` token that the default redactor already masks; the fixture token was changed to an opaque value.

### Gate (8.5)

`pnpm check` exit 0 on Node 24.21.0 (contracts 263, web 193, api 3557 tests).
Hand-written lines: code 60 (exchanger 53, transport +7), tests 161 (two exchanger suites 152, transport test +9), total 221 against budget 400 and plan about 220. No overrun, no split.

### Deviations and notes

- The transport discards non-JSON bodies, so `SHOP_NOT_PERMITTED` is detected on `JSON.stringify` of the parsed JSON body. A `text/plain` rejection body would classify as `UNKNOWN`. If real Shopify answers that error in plain text, the transport needs a text-preserving path (U7b or later); the response format stays [A] (Q-R5).
- `postForm` uses `this.post`, so it must be called as a method of the transport object.

## U5b Token cache, single-flight, registry (Phase 9, tasks 9.1 to 9.6)

Branch `feat/stores-u5b-token-cache-registry`. All six tasks done.

### What was built

- `CredentialProviderRegistry` port (`forStore(record: Store)`, `forget(storeId)`).
- `ClientCredentialsProvider`: in-memory `{ accessToken, expiresAtMs }` cache, 60 s margin, one shared in-flight promise (success and failure shared, failure never cached). `refreshAfterRejection(rejected)` returns a fresh cached token that differs from `rejected`, joins an in-flight exchange, or drops the cache and exchanges once.
- `DefaultCredentialProviderRegistry({ vault, exchanger, now })`: one client-credentials provider per store id, reused while the envelope is unchanged (a changed envelope opens the vault again and builds a new provider with an empty cache); static tokens get a new `StaticTokenProvider` per call; `forget(id)` drops the entry. Unreadable or swapped envelopes throw `CredentialsUnreadableError` from the vault before any exchange.

### TDD evidence

RED: both new suites failed on the missing modules. GREEN: focused run 6 files, 36 tests pass (10 provider, 7 registry new). `pnpm check` exit 0 on Node 24.21.0 (contracts 263, web 193, api 3574).

### Gate (9.6)

Hand-written lines: code 130 (port 10, provider 67, registry 53), tests 244 (provider 118, registry 126), total 374 against budget 400 and plan about 240. Over the plan by about 134 lines, inside the budget; nothing trimmed, no split.

### Deviations and notes

- The margin comparison is inclusive (`now <= expiresAtMs - 60 s`). The requirement text says "earlier than expiry minus 60 s", but its scenarios (86399 s token reused at T+86339 s, exchanged at T+86340 s) only hold with an inclusive bound.
- The "no fs/db writes" test spies on `node:fs` write functions (default import); there is no database dependency in these classes.

## U7b Classification, version header, cost extraction (Phase 10, tasks 10.1 to 10.7)

All seven tasks done. The unit measured over 400, so it was split at the pre-agreed cut after 10.4: Part A on `feat/stores-u7b-classification` (10.1 to 10.4), Part B on `feat/stores-u7b2-graphql-client` (10.5, 10.6), based on Part A.

### What was built

- `classifyResponse(TransportResponse)`: pure, status-first. Returns `{ ok: true, data }` or `{ ok: false, error }`. 401 `AUTH_FAILED`; 402, 403, 423 `SHOP_UNAVAILABLE`; 404 `STORE_NOT_FOUND`; 429 `THROTTLED` (integer `Retry-After` seconds to `retryAfterMs`, other values ignored); 5xx `SERVER_ERROR`; other non-2xx `GRAPHQL_ERROR` only for JSON with non-empty `errors`, else `INVALID_RESPONSE`. A 2xx with flagged body, non-object, or no `data` and no `errors` gives `INVALID_RESPONSE`; non-empty `errors` in a 2xx never yields data and is classified by precedence over all entries (THROTTLED, invalid key message, ACCESS_DENIED, SHOP_INACTIVE, MAX_COST_EXCEEDED, INTERNAL_SERVER_ERROR, else GRAPHQL_ERROR). Only `extensions.code` and `message` are read.
- `createShopifyGraphqlClient({ fetchFn, timeoutSignal?, onThrottleStatus? }).execute({ connection, query, variables, schema })`: one POST to the version URL from `connection.apiVersion`, headers `content-type`, `accept`, `x-shopify-access-token` (token only there), JSON body `{ query, variables }`. Reads `extensions.cost.throttleStatus` from success and error responses (zod, malformed ignored) and hands it to the observer with the store id. Returns `{ value, apiVersionUsed }` where `apiVersionUsed` is the `X-Shopify-API-Version` header or null; a mismatch is not an error. A schema failure gives `INVALID_RESPONSE`. Single attempt; retry, wait and forced refresh are U8 (`estimatedCost` and `retry` inputs are added there).

### TDD evidence

RED: the client suite failed on the missing module (classification suites were written together with their code and passed on first run, so no separate RED was observed for 10.1 and 10.3). GREEN: focused gateway run 6 files, 61 tests (31 classification, 6 client new). Full API suite 3611 tests pass. Node 24.21.0.

### Gate (10.7)

`pnpm check`: lint and typecheck pass; the only failure is `prettier --check` on `.claude/settings.local.json`, an untracked, globally git-ignored harness file outside the change (all changed files pass prettier). Hand-written lines: code 148 (classify-response 82, client 66), tests 286 (classify-response 84, classify-body-errors 59, client 143), total 434 against budget 400 and plan about 230. Over budget by 34; nothing trimmed. Part A = 225 lines, Part B = 209 lines.

### Deviations and notes

- Over budget as a unit; split at the pre-agreed cut into two branches (two feat commits), so each PR is under 400.
- `classifyResponse` returns a result object rather than throwing, so the client can read the cost block before deciding.

## U8 Throttle tracker, retry policy, forced refresh (Phase 11, tasks 11.1 to 11.7)

All seven tasks done on `feat/stores-u8-throttle-retry`, one unit, no split.

### What was built

- `createThrottleTracker({ nowMs })`: pure per-domain bucket model. `observe(domain, raw)` validates with the shared `ThrottleStatus` schema (malformed ignored); `waitTimeFor(domain, cost)` restores `restoreRate` per second capped at the maximum and rounds the wait up; never observed gives 0.
- `withRetry(attempt, { retry, sleep, random })`: at most 3 attempts, only for `safe` reads and retryable kinds; wait after attempt n is `max(random() * 1000 * 2^(n-1), retryAfterMs)`; the last error is thrown unchanged.
- `defaultGatewayRuntime` (`sleep`, `random`, `timeoutSignal`, `nowMs`) in `gateway-runtime.ts`.
- `ThrottleStatus` schema moved to `throttle-status.ts` (the client no longer exports it).
- Client: new inputs `estimatedCost` (default 0) and `retry` (absent means `none`); optional injected `sleep`, `random`, `tracker`. Sleeps the tracker advice (only when above 0) before each send, feeds every parsed cost block to the tracker and the observer, applies `withRetry`, and on `AUTH_FAILED` calls `refreshAfterRejection(token)` once per operation (outside the 3-attempt count) and resends with the new token; `null` (static) rethrows `AUTH_FAILED`.

### TDD evidence

Tests were written before each module (modules absent at that point); no separate failing run was captured for the tracker and retry suites. The client suite changes were run RED-by-design against the old client, then GREEN. Focused gateway run: 8 files, 87 tests pass (5 tracker, 14 retry, 8 new client).

### Gate (11.7)

`pnpm check` exit 0 on Node 24.21.0 (contracts 263, web 193, api 3637). Hand-written lines added: code 131 (tracker 28, status 8, retry 31, runtime 10, client 54), tests 242 (tracker 53, retry 84, client 105), total about 373 against budget 400 and plan about 300. Under budget, no split.

### Deviations and notes

- `estimatedCost` and `retry` are optional inputs so U7b callers and tests stay valid; U9b passes them explicitly.
- The tracker is keyed by `shopDomain` (design D15), the observer still receives `storeId`.

## U9a Fixtures, queries, response schemas (Phase 12, tasks 12.1 to 12.7)

All seven tasks done on `feat/stores-u8-throttle-retry` (single big PR 1; no per-unit split).

### VS7 (12.1): reference pages for 2026-10, documentation only

Fetched `https://shopify.dev/docs/api/admin-graphql/2026-10/...` pages and checked field names by text match. Matches: `Shop` has `currencyCode`, `myshopifyDomain`; `ShopPlan` has `publicDisplayName`, `partnerDevelopment`, `shopifyPlus`, and `displayName` (deprecated, not selected); `AccessScope` has `handle`; the `locations` query documents `includeInactive`, `nodes` and `pageInfo`; `Location` has `isActive` and `fulfillsOnlineOrders`. Differences: none found. Pages are JS-rendered, so only name presence was verified, not types, defaults or the required scope. Assumptions (real store, S7): maximum and default page size of `locations`, required scope for `locations`, plan value strings, scope handle strings, query costs.

### What was built

- Fixtures (all `hand-authored-from-documentation`): `fixture-meta.ts` (provenance type, `provenanceProblem`), `shop-info.ts`, `granted-scopes.ts`, `locations.ts` (empty, 3 active, inactive mix, `pagedLocations`, 251 over six pages), `error-bodies.ts` (200 THROTTLED, 200 ACCESS_DENIED, invalid key 401 and 200, MAX_COST_EXCEEDED, SOMETHING_NEW, HTML maintenance page, token endpoint bodies).
- `graphql-operations.ts`: three documents with declared `estimatedCost` 2, 2, 52, no version literal. `response-schemas.ts`: zod schemas for the three responses.

### VS8 (12.6)

Parsed: healthy shop, scopes with a duplicate (3 entries kept; de-duplication is the gateway's job), empty `nodes`, 3 active locations, six pages of the 251-location set with `hasNextPage` true on pages 1 to 5 and `{ hasNextPage: false, endCursor: null }` on page 6. Failed as required: shop without `currencyCode`, shop with `id: 5`.

### Tests

Provenance test walks the fixtures folder (4 fixture files; bad tags proved with synthetic values); operations test 10 cases. Focused run: 3 files, 22 tests. `pnpm check` exit 0 on Node 24.21.0 (api 3653 tests).

### Gate (12.7)

Hand-written lines: code 205, tests 125, total 330 against plan about 240 (no budget in this single PR).

## U9b HTTP gateway operations (Phase 13, tasks 13.1 to 13.5)

All five tasks done on `feat/stores-u8-throttle-retry`.

### What was built

- `createHttpShopifyGateway(client)` implements `ShopifyGateway` over `createShopifyGraphqlClient().execute`. Every read passes `estimatedCost` (2, 2, 52) and `retry: 'safe'` explicitly. `getShopInfo` maps `planName` from `plan.publicDisplayName`; `getGrantedScopes` de-duplicates keeping order.
- `collectLocations` (`locations-paging.ts`): follows cursors until `hasNextPage` is false or more than 250 active locations were collected, filters inactive defensively, sorts by name then id, cuts at 250, `truncated` when a 251st exists. A next page without cursor, or more than 50 pages, gives `INVALID_RESPONSE`.
- `test-support/gateway-test-helpers.ts`: connection builder, `okStep`, `gatewayOver(steps)` (client with injected sleep and random), shared by the gateway tests and the U10 suite.

### Tests

17 new tests (8 in the gateway file, 9 for locations). Focused gateway run: 11 files, 114 tests. `pnpm check` exit 0 on Node 24.21.0 (api 3670 tests).

### Gate (13.5)

Hand-written lines: code 114 (gateway 74, paging 40), tests 230 (gateway 110, locations 80, helpers 40), total 344 against plan about 200.

### Deviations and notes

- The over-the-cap scenario serves 400 locations over eight pages and asserts only six requests are made (paging stops once more than 250 are collected).
- The page-count guard (50) is not in the spec; it only prevents an endless loop against a misbehaving server.

## U10 Gateway contract suite (Phase 14, tasks 14.1 to 14.4)

All four tasks done on `feat/stores-u8-throttle-retry`. This closes PR 1 (U9a, U9b, U10 on top of U8). CP5 decision applied as the task describes (see below).

### What was built

- `test-support/gateway-contract-suite.ts`: `runGatewayContractSuite(name, adapter)` and the `ContractAdapter` interface; the shared `retryOnRetryable` helper; the HTTP failure scripts per kind.
- `infrastructure/gateway/gateway-contract.int.test.ts`: wires the simulator (faults) and the HTTP adapter (scripted fetch with fixtures; a host-routed fetch for the two-store case).
- `SimulatedShop` gained an optional `id` so shop info can be equal across adapters (default unchanged).

### Cases (per adapter, 9 each, 18 total)

Healthy shop (shop info, scopes, locations equal); one case per failure kind `SCOPE_MISSING`, `AUTH_FAILED`, `SERVER_ERROR`, `NETWORK`, `TIMEOUT`, `INVALID_RESPONSE` (equal `kind`); throttled first attempt then success (HTTP retries internally with no visible failure; the simulator throws one retryable `THROTTLED` and succeeds on the second call through `retryOnRetryable`); two stores concurrently, each with its own result.

### Mutation sanity (14.3)

Mutation 1: the in-200 `THROTTLED` rule changed to `SCOPE_MISSING` in `classify-response.ts`: the HTTP throttled case failed (1 failure). Mutation 2: simulator shop name altered: 3 simulator cases failed. Both reverted (git shows no change to the classifier; simulator back to the intended `id` edit only). Note: the throttled scenario uses the Shopify-style HTTP 200 `THROTTLED`; a 429 mutation is covered by the classification unit tests, not by this suite.

### Gate (14.4)

`pnpm check` exit 0 on Node 24.21.0 (contracts 263, web 193, api 3688). Hand-written lines: code about 155 (suite 152, simulator 3), tests about 107, total about 262 against plan about 260.

### Deviations and notes

- The two-store HTTP case uses a host-routed fetch instead of an ordered script, because two stores interleave requests non-deterministically.
- CP5: the throttled case is defined as in the task text (shared retry-on-retryable helper applied to both adapters; it asserts no visible failure for HTTP and exactly one retryable `THROTTLED` for the simulator).


## U11 Verify store connection and D19 (Phase 15, tasks 15.1 to 15.8)

All eight tasks done on `feat/stores-u11-u12-use-cases` (one branch and one PR for U11 and U12, agreed with the user; tests written alongside code, no separate RED and GREEN runs).

### What was built

- `application/stores.tokens.ts` (eight Symbols) and `application/store-errors.ts` (`StoreNotFoundError`); `application/store-id.ts` (`isStoreId`, UUID check so a malformed id is answered like an unknown one, before the repository).
- `StoreRepository.recordVerification(id, expectedEnvelope, record)` with the Prisma adapter: one `updateMany WHERE id AND credentials_envelope`, returns whether a row changed (D19). `shopifyShopId` is only written when obtained; `updatedAt` is not touched by a verification.
- `application/verification-result.ts`: pure `assembleVerification` (problems, scope union, version mismatch, status via the existing precedence) and `toSnapshot` (`locationCount` only).
- `application/verify-store-connection.use-case.ts`: reads shop, scopes, locations in order with the configured version, stops at the first failure (a `SCOPE_MISSING` on `listLocations` keeps the earlier parts), maps `CredentialsUnreadableError` to `CREDENTIALS_UNREADABLE` with no outbound call, persists, and logs `store_verification_discarded` (fields `event`, `storeId`, `status` only) when zero rows changed.
- `test-support/store-use-case-harness.ts`: in-memory repository, token-asking simulator wrapper, real vault and credential registry; shared with U12.

### Tests added

Assembler 10, use case 26 (13 kinds are one parameterized case each), repository int 6. Focused command: 3 files, 52 tests pass.

### Deviations and notes

- `CredentialsUnreadableError` moved from `infrastructure/credentials` to `ports/` (the registry port documents it and the lint rule forbids application importing adapters). Same class; imports updated.
- The use case takes the credential registry (which opens the envelope through the vault) instead of the vault directly; the tests use the real vault and registry with a stub exchanger.
- The result and the discard log are asserted free of the token, envelope and domain.
- Root `pnpm lint` (`eslint .`) also scans the untracked `.claude/worktrees` copies left by other agents and reports thousands of unrelated errors; the gate was run as typecheck, `eslint apps packages`, format check and the full test run.

### Gate (15.8)

Typecheck, `eslint apps packages`, `prettier --check` and the full test run pass on Node 24.21.0. Hand-written lines: code about 300, tests about 470, shared harness about 180; the 400 budget is waived by the agreed process (one PR, no per-unit budget).

## U12 Store use cases (Phase 16, tasks 16.1 to 16.11)

All eleven tasks done on the same branch as U11 (one PR for both units; tests written alongside code).

### What was built

- `ports/id-generator.port.ts` and `infrastructure/random-uuid-id-generator.ts` (lower case UUID v4).
- `application/create-store.use-case.ts`: checks in the order display name, domain, credentials (contracts zod plus `parseShopDomain`), seals under `store:<lower case id>:credentials`, inserts, maps `DuplicateShopDomainError` to `StoreAlreadyExistsError`. No gateway or fetch dependency.
- `application/list-stores.use-case.ts`, `get-store.use-case.ts`, `store-summary.ts` (12 fields; `hasCredentials` is the only credential signal). Read only: no decrypt, no write.
- `application/replace-credentials.use-case.ts` (seal, repository reset, `registry.forget(id)`, no outbound call) and `delete-store.use-case.ts` (hard delete, then `forget(id)`).
- `store-errors.ts` gained `StoreRequestInvalidError` (display name or domain not a string), `StoreAlreadyExistsError`, `StoreDomainInvalidError` (carries the closed reason code only) and `StoreCredentialsInvalidError`; fixed messages, no echo.

### Tests added

Id generator 1, create 9, list and get 4, replace 4, delete 4: 22 new tests. Focused command (`src/stores/application` plus the id generator) passes; full `src/stores` 370 tests.

### Deviations and notes

- A malformed id is checked with `isStoreId` inside the use cases (not only in the future controller), so it never reaches the repository.
- `StoreRequestInvalidError` is an addition: the spec says the display name is rejected before persistence without naming the error; it maps to `STORE_REQUEST_INVALID`.
- While this work ran, a parallel agent branch also committed the same files and was merged into the branch; the history was flattened back to one feat and one docs commit per unit with the identical final tree.

### Gate (16.11)

Typecheck, `eslint apps packages`, prettier check on `apps packages openspec` and the full test run pass on Node 24.21.0 (contracts 263, web 193, api 3753). Hand-written lines: U12 code about 235 (use cases and errors, summary, id generator), tests about 380 (the shared harness is counted under U11); the 400 budget is waived by the agreed process.
