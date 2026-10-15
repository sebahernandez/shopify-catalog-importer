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
