# Tasks: Stores and Shopify Gateway (S2)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~5,200 hand-written as planned (design figures, about 35% uncertainty; realistic range 5,500 to 6,800 after the S1 overrun pattern). Contracts and catalog changes are counted inside each unit total. Generated: one Prisma migration SQL (counted once, in U3). No lockfile change expected (no new dependency). Deletions negligible. |
| 400-line budget risk | High for the change as a whole. Every unit is planned within 400. Near budget: U2 (~360), U3 (~380), U11 (~340), U4 (~340), U12 (~330). S1 lesson: test-heavy units measured 1.3x to 2x their plan, and lines are counted with blanks, comments and contracts. |
| Chained PRs recommended | Yes |
| Suggested split | 19 planned chained work units (U1, U2, U3, U4, U6a, U6b, U7a, U5a, U5b, U7b, U8, U9a, U9b, U10, U11, U12, U13a, U13b, U14), one planning PR for the artifacts, plus a final gate that rides on the U14 PR. Expect 5 to 8 further splits at apply time (see pre-agreed split points). |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain (tracker branch: develop) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

No remaining decision. Resolved:
- Chain strategy is feature-branch-chain from develop, as in S0 and S1 (state.yaml). The planning PR (proposal, specs, design, tasks) targets develop and merges first; U1 targets develop; every later PR targets the branch of the previous unit in the chain order below. Only develop receives merges.
- Any unit that measures over 400 hand-written lines at apply time is reported and split at its pre-agreed point (below), never trimmed (no comment or test removal to fit). S1 needed 6 more splits than planned because overruns were found only at the end of a unit; measure at every RED/GREEN pair boundary and stop at the pre-agreed cut when the running total passes about 330.
- Order change against the proposal (from the design): U6a follows U2; U7a precedes U5a (the exchanger reuses the transport); U8 needs U4. The linear chain order below respects every dependency.
- Design D19 (conditional `recordVerification`) is delivered in U11 with the use case, not in U3; U3 holds insert, find, list, replace and delete only.

Estimates keep the design's figures. They were not shrunk to fit. U7a adds about 50 lines for the scripted-fetch test helper that the design lists under test-support (planned 230, now ~280).

### Chain order and bases (feature-branch-chain, tracker = develop)

U1, U2, U3, U4, U6a, U6b, U7a, U5a, U5b, U7b, U8, U9a, U9b, U10, U11, U12, U13a, U13b, U14. PR for U1 targets develop. Phase N below equals the Nth unit in this order (Phase 1 = U1 ... Phase 19 = U14); Phase 20 rides on the U14 PR. If a child PR shows the previous unit's changes, its base is wrong and must be retargeted.

### Size and scope per work unit

| Unit | Phase | Branch | Scope | Depends on | Hand-written lines |
|---|---|---|---|---|---|
| U1 | 1 | `feat/stores-u1-contracts` | Contracts (scopes, errors, stores, verification) and five ApiError codes | none (S0, S1 archived) | ~300 |
| U2 | 2 | `feat/stores-u2-domain-core` | Lint block, Clock port, shop domain guard, scope diff, status mapping, store rules, provider port type | U1 | ~360 |
| U3 | 3 | `feat/stores-u3-persistence` | Prisma model, migration, apply-migrations helper, four moved int tests, expected-table check, repository | U2 | ~380 |
| U4 | 4 | `feat/stores-u4-secretbox-vault` | DeferredSecretBox, boot binding, AppModule option, vault, static provider | U2 | ~340 |
| U6a | 5 | `feat/stores-u6a-gateway-port` | ShopifyGatewayError, ShopifyGateway port, StoreConnection | U2 | ~180 |
| U6b | 6 | `feat/stores-u6b-simulator` | Simulated gateway with fault injection | U6a | ~240 |
| U7a | 7 | `feat/stores-u7a-transport` | Scripted fetch helper, URL builder, transport, VS1 to VS3 | U6a | ~280 |
| U5a | 8 | `feat/stores-u5a-exchanger` | Client-credentials exchanger and its failure classification | U4, U7a | ~220 |
| U5b | 9 | `feat/stores-u5b-token-cache` | Token cache, single-flight, forced refresh, registry, forget | U5a | ~240 |
| U7b | 10 | `feat/stores-u7b-classification` | Status and body classification, version header, cost extraction, client without retry | U7a | ~230 |
| U8 | 11 | `feat/stores-u8-throttle-retry` | ThrottleTracker, RetryPolicy, forced-refresh attempt | U7b, U4 | ~300 |
| U9a | 12 | `feat/stores-u9a-queries-fixtures` | Provenance-tagged fixtures, queries, zod schemas, VS7, VS8 | U8 | ~240 |
| U9b | 13 | `feat/stores-u9b-http-gateway` | HTTP gateway operations, locations paging, sort and cap | U9a | ~200 |
| U10 | 14 | `feat/stores-u10-contract-suite` | Gateway contract suite over simulator and HTTP adapter | U6b, U9b | ~260 |
| U11 | 15 | `feat/stores-u11-verify-use-case` | VerifyStoreConnection, assembler, D19 conditional update | U3, U5b, U10 | ~340 |
| U12 | 16 | `feat/stores-u12-store-use-cases` | IdGenerator, create, list, get, replace, delete use cases | U3, U4, U5b | ~330 |
| U13a | 17 | `feat/stores-u13a-controller-module` | Exception filter, controller, StoresModule, AppModule wiring, route test edit | U11, U12 | ~260 |
| U13b | 18 | `feat/stores-u13b-http-int` | HTTP integration tests, VS9 and the D21 decision, real boot test | U13a | ~220 |
| U14 | 19 | `feat/stores-u14-canaries-readme` | Canary suite, log field test, VS10, source scan, README, spec-delta reconcile | U13b | ~280 |

Total about 5,200 planned. Task total: 176 checkbox tasks in 20 phases (see the Coverage Table footer).

### Pre-agreed split points (applied only if a unit measures over 400)

Each part gets its own branch based on the previous part and its own gate (the unit's focused command narrowed to the part, plus `pnpm check`). Task ids stay stable; the gate task is repeated for the part.

| Unit | Cut after | Part A | Part B |
|---|---|---|---|
| U2 (watch) | 2.8 | 2.1 to 2.8 (lint, Clock, shop domain guard) | 2.9 to 2.15 (scope diff, status mapping, store rules, provider port type) |
| U3 | 3.12 | 3.1 to 3.12 (helper, migration, expected-table check, four moved tests) | 3.13 to 3.15 (repository port and adapter) |
| U5a | 8.2 | request and success parsing | failure classification (8.3, 8.4) |
| U5b | 9.3 | client-credentials provider (cache, single-flight, forced refresh) | registry and `forget` (9.4, 9.5) |
| U7b | 10.4 | status and body classification (10.1 to 10.4) | graphql client without retry (10.5, 10.6) |
| U8 | 11.4 | tracker and retry policy (11.1 to 11.4) | client integration of wait, retry, forced refresh (11.5, 11.6) |
| U9a | 12.3 | VS7 and fixtures with provenance (12.1 to 12.3) | queries, schemas, VS8 (12.4 to 12.6) |
| U11 | 15.5 | tokens, errors, D19 conditional update, assembler (15.1 to 15.5) | use case (15.6, 15.7) |
| U12 | 16.6 | id generator, create, list, get (16.1 to 16.6) | replace and delete (16.7 to 16.10) |
| U13a | 17.2 | exception filter (17.1, 17.2) | controller, module, wiring, route test (17.3 to 17.8) |
| U14 (watch) | 19.8 | canary helpers, log fields, flows, leak surfaces (19.1 to 19.8) | source scan, README, spec reconcile (19.9 to 19.13) |
| U7a (watch) | 7.5 | scripted fetch, VS1, URL builder (7.1 to 7.5) | transport, VS2, VS3 (7.6 to 7.8) |

### Suggested Work Units

All focused commands are run from the repository root. "N/A" harness means no app boot: every proof is an in-process test; apply agents never boot the app.

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| U1 | Store contracts and ApiError codes | PR 2 | `pnpm --filter @importer/contracts test` | N/A: pure schemas; `pnpm --filter @importer/web test` confirms the closed enum change breaks nothing | `packages/contracts/src/{stores,store-verification,shopify-errors,shopify-scopes}*`, `api-error*`, `index.ts` |
| U2 | Domain core and lint | PR 3 | `pnpm --filter @importer/api exec vitest run src/stores/domain src/shared-kernel/time` | N/A: pure functions; lint negative gate in 2.2 | `stores/domain/**`, `shared-kernel/time/**`, the eslint block |
| U3 | Persistence and migration helper | PR 4 | `pnpm --filter @importer/api exec vitest run src/persistence src/stores/infrastructure/persistence src/key-boot.int.test.ts src/main.int.test.ts src/health` | Real `prisma migrate deploy` on a sandbox database (the int tests) | `prisma/schema.prisma`, the `_stores` migration folder, `persistence/{expected-tables,prisma.service}`, `persistence/test-support/**`, repository files, four edited int tests |
| U4 | SecretBox binding, vault, static provider | PR 5 | `pnpm --filter @importer/api exec vitest run src/shared-kernel/secret-box src/stores/infrastructure/credentials src/main.int.test.ts` | `bootstrap()` in process on a sandbox (main int test); no external boot | `deferred-secret-box*`, `main.ts` and `app.module.ts` edits, `credentials/{store-credential-vault,static-token-provider}*` |
| U6a | Gateway port and error | PR 6 | `pnpm --filter @importer/api exec vitest run src/stores/ports` | N/A: types and one error class | `stores/ports/shopify-gateway*` |
| U6b | Simulator | PR 7 | `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/simulator` | N/A: in-memory | `infrastructure/simulator/**` |
| U7a | Transport | PR 8 | `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/gateway src/stores/test-support` | Real `fetch` against two loopback servers for VS1 (int test) | `infrastructure/gateway/{shopify-urls,shopify-request,shopify-http-transport,capped-body-reader,transport-limits}*`, `test-support/scripted-fetch*` |
| U5a | Exchanger | PR 9 | `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/credentials/client-credentials-exchanger` | N/A: scripted fetch | `credentials/client-credentials-exchanger*`, the transport form-body extension |
| U5b | Token cache and registry | PR 10 | `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/credentials` | N/A: fake clock and scripted exchanger | `credentials/{client-credentials-provider,default-credential-provider-registry}*`, registry port |
| U7b | Classification and client | PR 11 | `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/gateway` | N/A: scripted fetch | `gateway/{classify-response,shopify-graphql-client}*` |
| U8 | Throttle and retry | PR 12 | `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/gateway` | N/A: recorded sleeper, fixed random, fake clock | `gateway/{throttle-tracker,retry-policy,gateway-runtime}*`, client edits |
| U9a | Queries and fixtures | PR 13 | `pnpm --filter @importer/api exec vitest run src/stores/test-support src/stores/infrastructure/gateway/graphql-operations.test.ts` | VS7 is a documentation read; VS8 parses fixtures | `gateway/{graphql-operations,response-schemas}*`, `test-support/fixtures/**` |
| U9b | HTTP gateway operations | PR 14 | `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/gateway` | N/A: scripted fetch with fixtures | `gateway/{http-shopify-gateway,locations-paging}*` |
| U10 | Contract suite | PR 15 | `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/gateway/gateway-contract.int.test.ts src/stores/test-support` | One suite over the simulator and the fixture-backed HTTP adapter | `test-support/gateway-contract-suite*`, `gateway/gateway-contract.int.test.ts` |
| U11 | Verification | PR 16 | `pnpm --filter @importer/api exec vitest run src/stores/application src/stores/infrastructure/persistence` | Use case over the simulator and a sandbox database | `application/{verify-store-connection,verification-result,stores.tokens,store-errors}*`, `recordVerification` in port and adapter |
| U12 | Store use cases | PR 17 | `pnpm --filter @importer/api exec vitest run src/stores/application` | N/A: fakes and spies | `application/{create,list,get,replace,delete}*`, `store-summary*`, `ports/id-generator*`, `infrastructure/random-uuid-id-generator*` |
| U13a | Controller and module | PR 18 | `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/http src/stores/stores.module.test.ts src/local-security/no-test-route-ships.test.ts` | N/A: unit tests with fakes | `infrastructure/http/{stores.controller,stores-exception.filter,store-request-parsing}*`, `stores.module.ts`, `app.module.ts`, `main.ts` test seam |
| U13b | HTTP integration | PR 19 | `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/http` | Real Nest app on an ephemeral loopback port and a sandbox database (in-process); real `bootstrap()` boot test | the int test files, conditional D21 fallback, conditional guard header edit |
| U14 | Canaries, README, spec reconcile | PR 20 | `pnpm --filter @importer/api exec vitest run src/stores` | Canary sweep over logs, responses, errors and database bytes (in-process); the orchestrator harness in 20.9 | `test-support/canaries*`, `store-log-fields*`, int and scan tests, `README.md`, delta spec edits |

PR 1 is the planning PR (proposal, specs, design, tasks). The final gate (Phase 20) rides on the U14 PR.

### Orchestrator checkpoints (not apply tasks)

- CP1, after U3 merges: the apply-migrations helper and the four moved int tests (prisma-key-check-store, key-boot, main, health) all pass on two migrations; full `pnpm test` is green; VS4 is recorded.
- CP2, after U4 merges: boot binding verified (VS6 and the boot test in `apps/api/src/main.int.test.ts`); a reconciliation failure never binds the box.
- CP3, after U7a merges: VS1, VS2 and VS3 are recorded; if `redirect: 'error'` or the cap behaviour differs from the design, stop and re-read U5a and U7b before starting them.
- CP4, after U9a merges: VS7 differences against the 2026-10 reference pages are listed; any field or scope that differs is a maintainer decision before U9b.
- CP5, after U10 merges: the contract suite is green on both adapters, and the definition of the throttled-then-success case (task 14.1) is confirmed.
- CP6, after U13b merges: the VS9 outcome (filter path or `bodyParser: false` fallback) is recorded; if the fallback was needed, expect about 80 more lines in U13b and a `main.ts` change.
- CP7, after U14: run the orchestrator harness (20.9), update `state.yaml` phases, run `sdd-verify`.
- Subagents never run `gentle-ai sdd-attempt` commands; the orchestrator does.

Conventions for every unit: conventional commits, no AI attribution, English code, comments and `ApiError` messages, Spanish only in the README (neutral register). Never contact Shopify: every outbound path takes an injected `fetchFn`, no test or task opens a connection to a real store, and no apply agent boots the app. Never read or write `.env*` files or key files. The delta spec files are authoritative for codes, field names, limits and wording; if the design differs, follow the spec. Paths in tasks are relative to the repository root. Record the focused test result, the runtime harness result and the measured hand-written line count (contracts and catalog changes included) in the apply progress.

## Phase 1: U1 Contracts

Branch `feat/stores-u1-contracts`. Depends on: none. Est ~300 lines. Focused: `pnpm --filter @importer/contracts test`.
Satisfies: store-registry (record, statuses, create body), credential-provider (two kinds), store-verification (capability set, problems shape), store-endpoints (ApiError codes). Design D3.

- [x] 1.1 Confirm names before coding (no file edit): record in the apply progress that the delta specs win over the design on codes and wording, that `apps/web` has no `ApiError` enumeration test so no web file changes (the store-endpoints spec already says so), and that no ApiError code exists for an unexpected 500 (design D20 answers Nest's generic 500 body; open item for the maintainer).
- [x] 1.2 RED: create `packages/contracts/src/shopify-scopes.test.ts`: `REQUIRED_CAPABILITIES` equals `write_products`, `write_files`, `write_inventory`, `locations` in that order; `locations` alternatives are `read_locations`, `read_inventory`, `read_markets_home`; the constants are frozen; the source has no `node:` import.
- [x] 1.3 GREEN: create `packages/contracts/src/shopify-scopes.ts`.
- [x] 1.4 RED: create `packages/contracts/src/shopify-errors.test.ts`: the 13 error kinds exactly (`AUTH_FAILED`, `SCOPE_MISSING`, `SHOP_UNAVAILABLE`, `STORE_NOT_FOUND`, `THROTTLED`, `QUERY_TOO_COSTLY`, `SERVER_ERROR`, `VERSION_UNSUPPORTED`, `NETWORK`, `TIMEOUT`, `INVALID_RESPONSE`, `GRAPHQL_ERROR`, `CREDENTIAL_EXCHANGE_FAILED`); `isRetryableKind` is true for exactly `THROTTLED`, `SERVER_ERROR`, `NETWORK`, `TIMEOUT`; exchange reasons are `SHOP_NOT_PERMITTED` and `UNKNOWN`; an unknown kind fails to parse.
- [x] 1.5 GREEN: create `packages/contracts/src/shopify-errors.ts`.
- [x] 1.6 RED: create `packages/contracts/src/stores-credentials.test.ts`: `static_token` with a 38 character token accepted; `client_credentials` accepted; rejected: unknown kind, missing `clientSecret`, 7 character `accessToken`, 7 character `clientSecret`, a 513 character value, an extra field; 8 and 512 characters accepted; `clientId` of 1 character accepted; a trailing newline is trimmed and the parsed value has no surrounding whitespace.
- [x] 1.7 GREEN: create `packages/contracts/src/stores.ts` with the auth kinds and the two strict credential payload schemas (trim, 1 to 512, 8 minimum for secrets).
- [x] 1.8 RED: create `packages/contracts/src/stores.test.ts`: create body is exactly `{ displayName, domain, credentials }` (an `id` field, any extra field, a missing field rejected); `displayName` trimmed and 1 and 80 code points accepted (an 80 emoji string counts 80), empty, whitespace only and 81 rejected; replace body is exactly `{ credentials }`; the summary schema has exactly the 12 listed fields and no others, `status` limited to `UNVERIFIED`, `CONNECTED`, `AUTH_FAILED`, `SCOPE_MISSING`, `UNAVAILABLE` (a sixth value fails), an unverified summary has the four verification fields null, timestamps are ISO 8601 UTC strings, `id` is a UUID.
- [x] 1.9 GREEN: extend `packages/contracts/src/stores.ts` with the request bodies, `StoreSummary` and the statuses.
- [x] 1.10 RED: create `packages/contracts/src/store-verification.test.ts`: result shape (`ok`, `checkedAt`, `shop` or null, `apiVersion` requested and used or null, `scopes` granted, required, missing, `locations`, `locationsTruncated`, `problems`); problem `params` accept strings, numbers and arrays of strings only (an object or boolean value fails); the two special codes `API_VERSION_MISMATCH` and `CREDENTIALS_UNREADABLE`; the snapshot schema has `locationCount` and rejects a `locations` array and any location field; `ok` true with problems fails.
- [x] 1.11 GREEN: create `packages/contracts/src/store-verification.ts`.
- [x] 1.12 RED: modify `packages/contracts/src/api-error.test.ts`: `STORE_NOT_FOUND`, `STORE_DOMAIN_INVALID`, `STORE_ALREADY_EXISTS`, `STORE_CREDENTIALS_INVALID`, `STORE_REQUEST_INVALID` parse; `HOST_NOT_ALLOWED`, `ORIGIN_NOT_ALLOWED` and the workbook codes still parse; an unknown code fails.
- [x] 1.13 GREEN: modify `packages/contracts/src/api-error.ts` with the five codes; export the four new modules from `packages/contracts/src/index.ts`.
- [x] 1.14 Run `pnpm --filter @importer/web test` to confirm the closed enum change breaks nothing; no web file is edited.
- [x] 1.15 U1 gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~300) and record them. Report any overrun, never trim.

## Phase 2: U2 Lint, shop domain guard, store rules

Branch `feat/stores-u2-domain-core`. Depends on: U1. Est ~360 lines (near budget; pre-agreed cut after 2.8). Focused: `pnpm --filter @importer/api exec vitest run src/stores/domain src/shared-kernel/time`.
Satisfies: shop-domain-guard (accepted forms, grammar, syntax and host rejections, suffix constant), store-verification (scope diff, status mapping), store-registry (initial state, replace reset). Design D2, D9, D10, D7 (port type).

- [x] 2.1 Modify `eslint.config.js`: add `'**/stores/**'` to `OTHER_MODULES`; add a block for `apps/api/src/stores/{domain,application}/**/*.ts` (tests ignored) forbidding `BUILT_INS`, `NEST`, `PRISMA` and `INFRASTRUCTURE` imports.
- [x] 2.2 Verify the negative gate: temporarily add `node:net` to a temporary file `apps/api/src/stores/domain/lint-gate-temp.ts`, confirm `pnpm lint` fails naming the import, then delete the file.
- [x] 2.3 RED: create `apps/api/src/shared-kernel/time/system-clock.test.ts`: `nowMs()` is within a small window of `Date.now()`; a fake object satisfying `Clock` is accepted by the type.
- [x] 2.4 GREEN: create `apps/api/src/shared-kernel/time/clock.port.ts` and `apps/api/src/shared-kernel/time/system-clock.ts`.
- [x] 2.5 RED: create `apps/api/src/stores/domain/shop-domain-syntax.test.ts` (steps 1 to 3 of the design algorithm, one table row per reason): `EMPTY`; `WHITESPACE` for ` mystore`, a trailing space and an embedded newline; `NON_ASCII` for a Cyrillic letter in `mystоre.myshopify.com` and a zero-width space after the domain; `BACKSLASH` for `mystore.myshopify.com\evil`; `PERCENT_ENCODING` for `mystore%2emyshopify.com`; `USERINFO` for `https://user:pw@mystore.myshopify.com` and `mystore.myshopify.com@evil.example`; `PORT` for `https://mystore.myshopify.com:8443/admin` and `:443`; `PATH` for `https://mystore.myshopify.com/other/path`, and for a bare input with a slash, question mark or hash; `TRAILING_DOT` for `mystore.myshopify.com.`; `IP_LITERAL` for `127.0.0.1`, `http://[::1]/`, `http://169.254.169.254/`; the first failing step wins; no reason value contains the input.
- [x] 2.6 GREEN: create `apps/api/src/stores/domain/shop-domain.ts` with the branded `ShopDomain`, the closed reason set and `parseShopDomain` steps 1 to 3 (own authority parsing, no `URL`, no `node:` import).
- [x] 2.7 RED: create `apps/api/src/stores/domain/shop-domain-host.test.ts` (steps 4 to 6 and canonical result): `MyStore` gives `mystore.myshopify.com`; the full domain; `https://mystore.myshopify.com/admin/products?limit=5#top` and `http://mystore.myshopify.com` give the canonical domain; `https://DEMO.myshopify.com/admin/products` equals `Demo`; path forms empty, single slash, `admin`, `admin/x` accepted; handle lengths 2 and 60 accepted, 1 and 61 `INVALID_HANDLE`; `my_store`, `-store`, `store-`, `my store` rejected; `xn--mystore-abc` `INVALID_HANDLE`; `2130706433` gives `2130706433.myshopify.com`; `myshopify.com.evil.example`, `evilmyshopify.com`, `https://evil.example/mystore.myshopify.com` (host checked before path), `https://shop.example.com`, apex `myshopify.com` give `WRONG_SUFFIX`; `a.b.myshopify.com` `EXTRA_LABELS`; `https://admin.shopify.com/store/mystore` `ADMIN_STORE_URL`; the module source has no `process.env`, no `URL` construction and the suffix is one constant.
- [x] 2.8 GREEN: extend `apps/api/src/stores/domain/shop-domain.ts` with steps 4 to 6 and the `.myshopify.com` suffix constant.
- [x] 2.9 RED: create `apps/api/src/stores/domain/scope-diff.test.ts`: all met by `write_products`, `write_files`, `write_inventory` (`write_inventory` implies `read_inventory` which meets `locations`); `read_products` with the two others gives `missing` `write_products`; `write_products`, `write_files`, `read_locations` gives `write_inventory` only; `write_products`, `write_files` gives `write_inventory`, `locations`; `read_files` alone leaves `write_files` missing (a read never meets a write); `missing` follows the order of `REQUIRED_CAPABILITIES`; `granted` is kept verbatim; empty granted gives the full required list.
- [x] 2.10 GREEN: create `apps/api/src/stores/domain/scope-diff.ts`.
- [x] 2.11 RED: create `apps/api/src/stores/domain/verification-status.test.ts`: no problems gives `CONNECTED`; `AUTH_FAILED` and `CREDENTIAL_EXCHANGE_FAILED` each give `AUTH_FAILED`; `SCOPE_MISSING` with `API_VERSION_MISMATCH` gives `SCOPE_MISSING`; one problem of each of `SHOP_UNAVAILABLE`, `STORE_NOT_FOUND`, `THROTTLED`, `QUERY_TOO_COSTLY`, `SERVER_ERROR`, `VERSION_UNSUPPORTED`, `NETWORK`, `TIMEOUT`, `INVALID_RESPONSE`, `GRAPHQL_ERROR` gives `UNAVAILABLE`; auth outranks scope outranks unavailable; `CONNECTED` if and only if there is no problem.
- [x] 2.12 GREEN: create `apps/api/src/stores/domain/verification-status.ts`.
- [x] 2.13 RED: create `apps/api/src/stores/domain/store-rules.test.ts`: a new store has status `UNVERIFIED`, the four verification fields null, `createdAt` equal to `updatedAt` from the given time; replacing credentials sets `UNVERIFIED`, nulls the four fields, may change `authKind`, keeps `id`, `displayName`, `shopDomain`, `createdAt` and never moves `updatedAt` earlier; credential payload types are discriminated by kind.
- [x] 2.14 GREEN: create `apps/api/src/stores/domain/store.ts` (record type), `apps/api/src/stores/domain/credentials-payload.ts` (payload types) and `apps/api/src/stores/domain/store-rules.ts`.
- [x] 2.15 Create `apps/api/src/stores/ports/credential-provider.port.ts` (type only: `authKind`, `accessToken()`, `refreshAfterRejection(rejected)` returning a token or null); verified by `pnpm typecheck` and the lint block.
- [x] 2.16 U2 gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~360, near budget) and record them. Report any overrun, never trim; split at 2.8 if needed.

## Phase 3: U3 Persistence, migration helper, repository

Branch `feat/stores-u3-persistence`. Depends on: U2. Est ~380 lines (near budget; pre-agreed cut after 3.12). Focused: `pnpm --filter @importer/api exec vitest run src/persistence src/stores/infrastructure/persistence src/key-boot.int.test.ts src/main.int.test.ts src/health`.
Satisfies: persistence-baseline (all four requirements), store-registry (unique domain, hard delete, replace, record), secret-protection (credentials only as an envelope, baseline-only database). Design D18, D5 (storage), VS4, VS5.

- [x] 3.1 RED: create `apps/api/src/persistence/test-support/apply-migrations.int.test.ts`: the helper applies every committed migration in order to an empty sandbox data directory (own temporary directory, `HOME` inside the sandbox, never the default data directory), reports status and output, a re-run exits 0 and changes nothing, and an option stops after the baseline migration.
- [x] 3.2 GREEN: create `apps/api/src/persistence/test-support/apply-migrations.ts` by extracting the isolated `prisma migrate deploy` run from `apps/api/src/persistence/baseline-migration.int.test.ts`.
- [x] 3.3 RED: modify `apps/api/src/persistence/baseline-migration.int.test.ts` to use the helper and expect: two migrations (baseline and stores) and the tables exactly `_prisma_migrations`, `app_setting`, `store`; upgrade from the baseline keeps an `app_setting` key-check row unchanged and creates `store`; an empty file records both migrations; a re-apply changes nothing and exits 0; the `store` columns are exactly `id`, `display_name`, `shop_domain`, `shopify_shop_id`, `api_version`, `auth_kind`, `credentials_envelope`, `status`, `last_verified_at`, `last_verification`, `created_at`, `updated_at`; `last_verification` is TEXT; a direct duplicate insert of `shop_domain` `demo.myshopify.com` fails with a unique constraint error; a database migrated only to the baseline holds no stored credential.
- [x] 3.4 GREEN: modify `apps/api/prisma/schema.prisma` (model `Store` mapped to `store`, snake_case columns, unique index on `shop_domain`, `auth_kind` and `status` plain strings) and generate and commit `apps/api/prisma/migrations/<timestamp>_stores/migration.sql` with Prisma against a temporary data directory (never the real one).
- [x] 3.5 Verify VS4: `migrate deploy` applies the second migration over a baseline database on SQLite, and `prisma migrate diff` between the migrations and the schema is empty; record commands and results.
- [x] 3.6 RED: create `apps/api/src/persistence/expected-tables.test.ts` (the list is exactly `app_setting` and `store`) and modify `apps/api/src/persistence/prisma.service.int.test.ts`: a baseline-only database aborts with `MIGRATION_REQUIRED`; a database without `app_setting` aborts; a fully migrated database passes; the database is unchanged after a failed start; the error text reveals no data.
- [x] 3.7 GREEN: create `apps/api/src/persistence/expected-tables.ts` and modify `apps/api/src/persistence/prisma.service.ts` so `connect()` checks every table in the list.
- [x] 3.8 Run the four existing int tests (`apps/api/src/persistence/prisma-key-check-store.int.test.ts`, `apps/api/src/key-boot.int.test.ts`, `apps/api/src/main.int.test.ts`, `apps/api/src/health/health.int.test.ts`) and record that each now fails with `MIGRATION_REQUIRED` because it applies only the baseline (RED evidence for 3.9 to 3.12).
- [x] 3.9 GREEN: modify `apps/api/src/persistence/prisma-key-check-store.int.test.ts` to apply migrations through the shared helper.
- [x] 3.10 GREEN: modify `apps/api/src/key-boot.int.test.ts` to use the shared helper.
- [x] 3.11 GREEN: modify `apps/api/src/main.int.test.ts` to use the shared helper.
- [x] 3.12 GREEN: modify `apps/api/src/health/health.int.test.ts` to use the shared helper; run the four tests and confirm they pass (checkpoint CP1).
- [x] 3.13 Create `apps/api/src/stores/ports/store-repository.port.ts`: `insert`, `findById`, `list`, `replaceCredentials`, `delete`, and `DuplicateShopDomainError` (type-only apart from the error class).
- [x] 3.14 RED: create `apps/api/src/stores/infrastructure/persistence/prisma-store-repository.int.test.ts` on a migrated sandbox database. First verify VS5: a unique violation through the better-sqlite3 adapter surfaces as `P2002`; record. Cases: insert and read map every field (ISO 8601 UTC dates, nulls for the four verification fields); `list` ordered by `createdAt` ascending then `id`; unknown id gives null; a duplicate domain maps to `DuplicateShopDomainError` and leaves the row count unchanged; two concurrent inserts of one domain leave exactly one row; `replaceCredentials` overwrites the envelope, sets `UNVERIFIED`, nulls the four fields, may change `authKind`, keeps `id`, `displayName`, `shopDomain`, `createdAt`, does not move `updatedAt` earlier; `delete` removes the row including the envelope and an unknown id reports not found; re-creating the domain after delete succeeds with a new id; a corrupt `last_verification` reads as null and emits a warning event without content; an unknown stored `status` or `auth_kind` is rejected by the mapper; every column of the row holds no canary.
- [x] 3.15 GREEN: create `apps/api/src/stores/infrastructure/persistence/prisma-store-repository.ts` and `apps/api/src/stores/infrastructure/persistence/store-mapper.ts` (zod-parsed snapshot, string statuses validated).
- [x] 3.16 U3 gate: run the focused test command and `pnpm check`; measure hand-written lines including the migration SQL (budget 400, planned ~380, near budget) and record them. Report any overrun, never trim; split at 3.12 if needed.

## Phase 4: U4 SecretBox binding, vault, static provider

Branch `feat/stores-u4-secretbox-vault`. Depends on: U2. Est ~340 lines. Focused: `pnpm --filter @importer/api exec vitest run src/shared-kernel/secret-box src/stores/infrastructure/credentials src/main.int.test.ts`.
Satisfies: secret-protection (injectable SecretBox, encrypted at rest per store), credential-provider (encrypted envelope bound to the store, static token needs no exchange, redactor registration). Design D4, D5, D6, VS6.

- [x] 4.1 RED: create `apps/api/src/shared-kernel/secret-box/deferred-secret-box.test.ts`: `encrypt` and `decrypt` before `bind` throw `SecretBoxError` `KEY_MISSING` with no key material and no plaintext in the message and nothing falls back to another key; after `bind(new AesGcmSecretBox(keyring))` a round trip works and a wrong context fails with `DECRYPT_FAILED`; a second `bind` throws; the box resolves the delegate at call time.
- [x] 4.2 GREEN: create `apps/api/src/shared-kernel/secret-box/deferred-secret-box.ts`.
- [x] 4.3 Verify VS6: create `apps/api/src/shared-kernel/secret-box/deferred-secret-box.int.test.ts` with a minimal Nest testing module that provides the holder with `useValue` under a token, creates the application, binds afterwards, and shows the consumer resolves the same instance and the bound box at call time; record the result (if the instance differs, stop and escalate).
- [x] 4.4 RED: modify `apps/api/src/main.int.test.ts`: boot binds the box exactly once after `reconcileKey`, with the keyring that is registered for redaction (a decrypted canary printed through the logger appears as `[REDACTED]`); a key file that does not match the stored key check aborts startup and the holder is never bound; the holder is handed to `AppModule.forRoot`. Test seam: an optional holder in `BootstrapOptions` that only tests pass.
- [x] 4.5 GREEN: modify `apps/api/src/main.ts` (create the `DeferredSecretBox` before `NestFactory.create`, pass it through `AppModule.forRoot`, bind after `reconcileKey` and `registerKeyring`) and `apps/api/src/app.module.ts` (`AppModuleOptions` gains `secretBox`, `logger` widens to `LoggerPort`); update every existing test that calls `AppModule.forRoot` (found by search, listed in the apply progress) to pass a box.
- [x] 4.6 RED: create `apps/api/src/stores/infrastructure/credentials/store-credential-vault.test.ts` over an `AesGcmSecretBox` with a test keyring: `seal` returns an envelope starting `sb1.` with no canary substring; `open` round trips under `store:<id>:credentials` (an upper case id is lowered); another store's context fails and surfaces as `CredentialsUnreadableError` with a fixed message and no cause; swapped envelopes of two stores are unreadable; a payload whose shape does not match `authKind` is unreadable; `accessToken` and `clientSecret` are registered for redaction on seal and on open (printing the canary gives `[REDACTED]`) and `clientId` is not; an unbound deferred box makes `seal` throw `SecretBoxError` and nothing is stored.
- [x] 4.7 GREEN: create `apps/api/src/stores/ports/credential-vault.port.ts`, `apps/api/src/stores/infrastructure/credentials/credentials-unreadable.error.ts` and `apps/api/src/stores/infrastructure/credentials/store-credential-vault.ts`.
- [x] 4.8 RED: create `apps/api/src/stores/infrastructure/credentials/static-token-provider.test.ts`: `authKind` is `static_token`; `accessToken()` returns the decrypted token with no request made (a `fetch` that fails the test is never called); `refreshAfterRejection` returns `null`.
- [x] 4.9 GREEN: create `apps/api/src/stores/infrastructure/credentials/static-token-provider.ts`.
- [x] 4.10 U4 gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~340) and record them. Report any overrun, never trim.

## Phase 5: U6a Gateway port and error

Branch `feat/stores-u6a-gateway-port`. Depends on: U2. Est ~180 lines. Focused: `pnpm --filter @importer/api exec vitest run src/stores/ports`.
Satisfies: shopify-gateway (read-only port with three operations, typed error without raw data). Design D13.

- [x] 5.1 RED: create `apps/api/src/stores/ports/shopify-gateway-error.test.ts`: one error of each of the 13 kinds; `retryable` is true for exactly `THROTTLED`, `SERVER_ERROR`, `NETWORK`, `TIMEOUT`; `retryAfterMs` optional; `reason` only on `CREDENTIAL_EXCHANGE_FAILED`; two errors of one kind built from different bodies have identical messages; the error has no `cause`, no body, headers or URL, and its `JSON.stringify` and own properties contain neither a canary token nor the URL path; the constructor accepts no original error.
- [x] 5.2 GREEN: create `apps/api/src/stores/ports/shopify-gateway-error.ts`.
- [x] 5.3 RED: create `apps/api/src/stores/ports/shopify-gateway.port.test.ts` (type-level, checked by `pnpm typecheck`): the keys of `ShopifyGateway` are exactly `getShopInfo`, `getGrantedScopes`, `listLocations`; no mutation member exists; `StoreConnection` carries `storeId`, `shopDomain` (a `ShopDomain`, a raw string fails to compile), `apiVersion` and `credentials`; every read returns `GatewayRead` with `apiVersionUsed` string or null.
- [x] 5.4 GREEN: create `apps/api/src/stores/ports/shopify-gateway.port.ts` (`ShopInfo`, `Location`, `StoreConnection`, `GatewayRead`, `ShopifyGateway`).
- [x] 5.5 U6a gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~180) and record them.

## Phase 6: U6b Simulator

Branch `feat/stores-u6b-simulator`. Depends on: U6a. Est ~240 lines. Focused: `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/simulator`.
Satisfies: shopify-gateway (simulated gateway with injectable faults, locations capped at 250 in the simulator). Design D22.

- [x] 6.1 RED: create `apps/api/src/stores/infrastructure/simulator/simulated-shopify-gateway.test.ts`: shops keyed by canonical domain with name, currency, plan, granted scopes and locations; reads return the configured data; an unknown domain (`ghost.myshopify.com`) throws `STORE_NOT_FOUND` for each operation; locations: 3 active gives 3 and `truncated` false, exactly 250 gives 250 and false, 251 gives 250 and true, one inactive and two active gives the two, ordered by name then id regardless of insertion order; scopes unique in order received; the source uses no timers, `Math.random` or `Date`; a call log records operation order for tests.
- [x] 6.2 GREEN: create `apps/api/src/stores/infrastructure/simulator/simulated-shopify-gateway.ts`.
- [x] 6.3 RED: create `apps/api/src/stores/infrastructure/simulator/simulated-shopify-gateway-faults.test.ts`: a `THROTTLED` fault on call 2 of `getShopInfo` only (calls 1 and 3 succeed, call 2 throws `THROTTLED` with `retryAfterMs` and `retryable` true); faults per operation and per call number for `AUTH_FAILED`, `SCOPE_MISSING`, `THROTTLED`, `NETWORK`, `TIMEOUT`, `SERVER_ERROR`, `INVALID_RESPONSE`; each throws a `ShopifyGatewayError` of that kind; a `VERSION_UNSUPPORTED` fault on a request for `2026-10` succeeds with `apiVersionUsed` different from `2026-10`; with no fault `apiVersionUsed` equals the requested version.
- [x] 6.4 GREEN: create `apps/api/src/stores/infrastructure/simulator/simulator-faults.ts` and wire it into the simulator.
- [x] 6.5 U6b gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~240) and record them.

## Phase 7: U7a URL builder and transport

Branch `feat/stores-u7a-transport`. Depends on: U6a. Est ~280 lines (design 230 plus the scripted-fetch helper; watch, pre-agreed cut after 7.5). Focused: `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/gateway src/stores/test-support`.
Satisfies: shop-domain-guard (URLs built only from the validated domain, redirects refused), shopify-gateway (transport limits). Design D11, D12, VS1, VS2, VS3.

- [x] 7.1 RED: create `apps/api/src/stores/test-support/scripted-fetch.test.ts`: responses are served in order, every call is recorded (URL, method, headers, body, options), a `never` step never resolves until aborted, a `throws` step rejects with a given error, a `body` step can stream chunks and abort mid-body, and calling past the script fails the test.
- [x] 7.2 GREEN: create `apps/api/src/stores/test-support/scripted-fetch.ts`.
- [x] 7.3 Verify VS1: create `apps/api/src/stores/infrastructure/gateway/redirect-refusal.int.test.ts` with two real loopback servers on ephemeral ports: Node 24 `fetch` with `redirect: 'error'` rejects on a 302 from the first and the second server receives zero requests; record the result.
- [x] 7.4 RED: create `apps/api/src/stores/infrastructure/gateway/shopify-urls.test.ts`: `mystore.myshopify.com` and `2026-10` give `https://mystore.myshopify.com/admin/api/2026-10/graphql.json`; the token URL is `https://mystore.myshopify.com/admin/oauth/access_token`; no port, userinfo or query; a version not matching the config pattern (`latest`, `2026-05`) is refused; passing a raw string fails to compile (`@ts-expect-error`) and a forged object is refused at run time with `fetch` never called.
- [x] 7.5 GREEN: create `apps/api/src/stores/infrastructure/gateway/shopify-urls.ts` and `apps/api/src/stores/infrastructure/gateway/shopify-request.ts` (private brand, only constructed by the URL module).
- [x] 7.6 RED: create `apps/api/src/stores/infrastructure/gateway/shopify-http-transport.test.ts` with the scripted fetch and injected `timeoutSignal`: POST only; the recorded options carry `redirect: 'error'`; a fetch that never resolves fails with `TIMEOUT` when the injected signal aborts at 15 s; an abort in the middle of the body also gives `TIMEOUT`; the default `AbortSignal.timeout` error names (`TimeoutError`, `AbortError`) are classified as `TIMEOUT` (VS2); a rejection with an `ENOTFOUND` cause and the URL in its message gives `NETWORK` and the serialized error exposes neither the URL nor the cause; a refused redirect gives `NETWORK` with no second request; a body of exactly 2,097,152 bytes is read, a body of 2,097,153 bytes is flagged oversize and the stream is cancelled without buffering the rest (VS3, counted bytes stay within the cap plus one chunk); `application/json; charset=utf-8` is accepted and `text/html` is flagged; unparseable JSON is flagged; the global `fetch` is never called. Result shape: the transport returns status, headers and a parsed-or-flagged body and throws only for timeout and network, so the status-first classification of U7b can run.
- [x] 7.7 GREEN: create `apps/api/src/stores/infrastructure/gateway/shopify-http-transport.ts`, `apps/api/src/stores/infrastructure/gateway/capped-body-reader.ts` and `apps/api/src/stores/infrastructure/gateway/transport-limits.ts` (15 s, 2,097,152 bytes as constants, no cause on any error).
- [x] 7.8 Record VS2 and VS3 in the apply progress: the abort error names observed under Vitest, an injected `timeoutSignal` aborting mid-body, the stream cancelled at the cap, and exactly 2,097,152 bytes accepted.
- [x] 7.9 U7a gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~280) and record them. Report any overrun, never trim.

## Phase 8: U5a Client-credentials exchanger

Branch `feat/stores-u5a-exchanger`. Depends on: U4, U7a. Est ~220 lines. Focused: `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/credentials/client-credentials-exchanger`.
Satisfies: credential-provider (exchange request, exchange failures classified from opaque bodies). Design D6, client-credentials exchange mechanism.

- [x] 8.1 RED: create `apps/api/src/stores/infrastructure/credentials/client-credentials-exchanger.test.ts` and extend `apps/api/src/stores/infrastructure/gateway/shopify-http-transport.test.ts` (the transport also sends an explicit content type and string body): exactly one form POST to the token URL with `Content-Type: application/x-www-form-urlencoded` and a body of `grant_type=client_credentials`, `client_id`, `client_secret`, no `X-Shopify-Access-Token` header, `redirect: 'error'`; a response with `access_token`, `scope` and `expires_in` 86399 returns the token and an expiry 86399 seconds after the injected clock time; fields other than `access_token`, `scope`, `expires_in` are ignored; a 200 without `access_token`, or a zero, negative or non-integer `expires_in`, gives `CREDENTIAL_EXCHANGE_FAILED`; every received token is registered for redaction before it is returned.
- [x] 8.2 GREEN: create `apps/api/src/stores/infrastructure/credentials/client-credentials-exchanger.ts` and extend `apps/api/src/stores/infrastructure/gateway/shopify-http-transport.ts` with the form request.
- [x] 8.3 RED: create `apps/api/src/stores/infrastructure/credentials/client-credentials-exchanger-failures.test.ts`: a 4xx whose text includes `Oauth error shop_not_permitted: Client credentials cannot be performed on this shop.` gives `CREDENTIAL_EXCHANGE_FAILED` with reason `SHOP_NOT_PERMITTED`; a 401 with an unrecognised body gives reason `UNKNOWN`; a connection error gives `NETWORK`, an abort `TIMEOUT`, a 503 `SERVER_ERROR`, a 429 `THROTTLED`; an unparseable 2xx gives `CREDENTIAL_EXCHANGE_FAILED`; a body containing the canary `client_secret` leaves no canary or body text in the message, properties or cause chain; messages are fixed strings and the `client_id` never appears.
- [x] 8.4 GREEN: extend `apps/api/src/stores/infrastructure/credentials/client-credentials-exchanger.ts` with the failure classification (body tested for `shop_not_permitted` then discarded).
- [x] 8.5 U5a gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~220) and record them. Split at 8.2 if needed.

## Phase 9: U5b Token cache, single-flight, registry

Branch `feat/stores-u5b-token-cache`. Depends on: U5a. Est ~240 lines. Focused: `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/credentials`.
Satisfies: credential-provider (token cache and margin, single-flight, forced refresh, memory only and redaction, drop on replace and delete, swapped envelopes). Design D7, D8.

- [ ] 9.1 Create `apps/api/src/stores/ports/credential-provider-registry.port.ts` (type only: `forStore(record)` and `forget(storeId)`).
- [ ] 9.2 RED: create `apps/api/src/stores/infrastructure/credentials/client-credentials-provider.test.ts` with a fake clock and a scripted exchanger: a token with `expires_in` 86399 obtained at T is reused at T plus 86339 s and exchanged again at T plus 86340 s (margin 60 s); stores A and B are independent; five concurrent calls on an empty cache send one exchange and all five get the same token; three concurrent calls on a failing exchange send one request and all three get the same failure kind; a failure is not cached and the next call exchanges again; `refreshAfterRejection` drops the cache and exchanges once; when the cache already holds a token different from the rejected one it returns that token without an exchange; concurrent forced refreshes for the same rejected token cause one exchange; a static provider returns `null` from refresh; nothing is written to the file system or database (spies).
- [ ] 9.3 GREEN: create `apps/api/src/stores/infrastructure/credentials/client-credentials-provider.ts`.
- [ ] 9.4 RED: create `apps/api/src/stores/infrastructure/credentials/default-credential-provider-registry.test.ts`: `forStore` builds a static provider for `static_token` and a client-credentials provider for `client_credentials`; the same store id and envelope returns the same provider (cached token survives across requests); a changed envelope returns a new provider with an empty cache; `forget(id)` drops the cached token so the next request exchanges again; swapped envelopes of two stores are reported unreadable with zero outbound calls; unreadable credentials surface as `CredentialsUnreadableError`; stores are independent.
- [ ] 9.5 GREEN: create `apps/api/src/stores/infrastructure/credentials/default-credential-provider-registry.ts`.
- [ ] 9.6 U5b gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~240) and record them. Split at 9.3 if needed.

## Phase 10: U7b Classification, version header, cost extraction

Branch `feat/stores-u7b-classification`. Depends on: U7a. Est ~230 lines. Focused: `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/gateway`.
Satisfies: shopify-gateway (classification by HTTP status, errors inside a 200, unknown shapes, request construction, API version header, cost extraction). Design D14, classification table rows 3 to 17, runtime-configuration (version used on every call).

- [ ] 10.1 RED: create `apps/api/src/stores/infrastructure/gateway/classify-response.test.ts` (status part, one case per row 3 to 9): 401 `AUTH_FAILED`; 402, 403, 423 `SHOP_UNAVAILABLE`; 404 `STORE_NOT_FOUND`; 429 `THROTTLED` with `Retry-After: 2` giving `retryAfterMs` 2000 (absent, negative or non-integer ignored); 503 and other 5xx `SERVER_ERROR`; 400 with JSON `{ "errors": [ { "message": "x" } ] }` `GRAPHQL_ERROR`; 418 with an HTML body `INVALID_RESPONSE`; a 5xx or 401 with an HTML body keeps its status kind; a 2xx with wrong content type, oversize, bad JSON, a non-object, an empty body, or neither `data` nor `errors` gives `INVALID_RESPONSE`; no result holds any part of the body.
- [ ] 10.2 GREEN: create `apps/api/src/stores/infrastructure/gateway/classify-response.ts` (pure, status-first).
- [ ] 10.3 RED: create `apps/api/src/stores/infrastructure/gateway/classify-body-errors.test.ts` (rows 10 to 17): 200 with `extensions.code` `THROTTLED` gives `THROTTLED`; message `Invalid API key or access token (unrecognized login or wrong password)` gives `AUTH_FAILED`; `ACCESS_DENIED` without `requiredAccess` or `path` gives `SCOPE_MISSING`; `SHOP_INACTIVE` gives `SHOP_UNAVAILABLE`; `MAX_COST_EXCEEDED` with message `Query cost is 2003, which exceeds the single query max cost limit (1000)` gives `QUERY_TOO_COSTLY`; `INTERNAL_SERVER_ERROR` gives `SERVER_ERROR`; `SOMETHING_NEW` gives `GRAPHQL_ERROR`; a body with both `THROTTLED` and `ACCESS_DENIED` gives `THROTTLED` (precedence across all entries); no `data` is used when `errors` is non-empty; two errors of one kind from different bodies have identical messages.
- [ ] 10.4 GREEN: extend `apps/api/src/stores/infrastructure/gateway/classify-response.ts` with the errors-in-200 rules.
- [ ] 10.5 RED: create `apps/api/src/stores/infrastructure/gateway/shopify-graphql-client.test.ts`: one POST to the version URL taken from config (`2026-10`, and `2027-01` when configured) with headers `Content-Type: application/json`, `Accept: application/json`, `X-Shopify-Access-Token` and a JSON body of `query` and `variables`; the token appears only in the header (scan URL, body, thrown errors); the injected `fetchFn` is used and the global `fetch` is never called; `X-Shopify-API-Version` matching returns it as `apiVersionUsed`, a different value (`2027-01` for `2026-10`) returns the data without throwing, an absent header gives null; `extensions.cost.throttleStatus` is read from success and error responses and handed to an observer, a malformed block is ignored; `data` failing the operation schema gives `INVALID_RESPONSE`.
- [ ] 10.6 GREEN: create `apps/api/src/stores/infrastructure/gateway/shopify-graphql-client.ts` (single attempt; wait, retry and forced refresh arrive in U8).
- [ ] 10.7 U7b gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~230) and record them. Split at 10.4 if needed.

## Phase 11: U8 Throttle tracker, retry policy, forced refresh

Branch `feat/stores-u8-throttle-retry`. Depends on: U7b, U4. Est ~300 lines. Focused: `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/gateway`.
Satisfies: shopify-gateway (cost tracking and throttle tracker, retry policy, non-retryable kinds and mutations), credential-provider (forced refresh on authentication failure). Design D7, D9, D15.

- [ ] 11.1 RED: create `apps/api/src/stores/infrastructure/gateway/throttle-tracker.test.ts` with a fake clock: 100 available, restore rate 50, maximum 1000 observed at T gives `waitTimeFor(300)` 4000 ms at T and 2000 ms at T plus 2 s; `waitTimeFor(80)` gives 0; 900 available, rate 100, maximum 1000, asked for 1000 at T plus 60 s gives 0 (capped at the maximum); a never observed store gives 0; a malformed cost block leaves the state unchanged; stores A and B are independent; the wait is rounded up.
- [ ] 11.2 GREEN: create `apps/api/src/stores/infrastructure/gateway/throttle-tracker.ts`.
- [ ] 11.3 RED: create `apps/api/src/stores/infrastructure/gateway/retry-policy.test.ts` with a recorded sleeper and fixed random: `THROTTLED` twice then success with random 0.5 gives 3 requests and waits 500 ms and 1000 ms; `SERVER_ERROR` on every attempt gives exactly 3 requests and the last error thrown unchanged; `THROTTLED` with `retryAfterMs` 5000 and random 0 waits 5000 ms; a smaller `retryAfterMs` than the backoff does not shorten it; `NETWORK` then `TIMEOUT` then success succeeds on attempt 3; `SCOPE_MISSING`, `QUERY_TOO_COSTLY`, `SHOP_UNAVAILABLE`, `STORE_NOT_FOUND`, `AUTH_FAILED`, `VERSION_UNSUPPORTED`, `INVALID_RESPONSE`, `GRAPHQL_ERROR`, `CREDENTIAL_EXCHANGE_FAILED` each send exactly one request; a request declared `retry: 'none'` with `THROTTLED` sends one request; a request with no retry mode and `SERVER_ERROR` sends one request.
- [ ] 11.4 GREEN: create `apps/api/src/stores/infrastructure/gateway/retry-policy.ts`.
- [ ] 11.5 RED: modify `apps/api/src/stores/infrastructure/gateway/shopify-graphql-client.test.ts`: the client sleeps the tracker's `waitTimeFor(estimatedCost)` before sending and feeds each response's `throttleStatus` to the tracker for its store; the retry policy is applied; on `AUTH_FAILED` with a client-credentials provider it calls `refreshAfterRejection` once and retries once with the new token and the read succeeds; a second `AUTH_FAILED` gives exactly two Admin API requests and one extra exchange and the result `AUTH_FAILED`; `SCOPE_MISSING`, `THROTTLED` and `SERVER_ERROR` never trigger a forced refresh; a static token 401 gives `AUTH_FAILED` after one request; the forced refresh attempt is outside the 3-attempt count.
- [ ] 11.6 GREEN: modify `apps/api/src/stores/infrastructure/gateway/shopify-graphql-client.ts` and create `apps/api/src/stores/infrastructure/gateway/gateway-runtime.ts` (default `sleep`, `random`, `timeoutSignal` as injected functions).
- [ ] 11.7 U8 gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~300) and record them. Split at 11.4 if needed.

## Phase 12: U9a Fixtures, queries, response schemas

Branch `feat/stores-u9a-queries-fixtures`. Depends on: U8. Est ~240 lines. Focused: `pnpm --filter @importer/api exec vitest run src/stores/test-support src/stores/infrastructure/gateway/graphql-operations.test.ts`.
Satisfies: shopify-gateway (shop info and scopes mapping inputs, shared-suite fixture provenance, request cost declarations), store-verification (fixture tags consistent). Design D16, VS7, VS8.

- [ ] 12.1 Verify VS7 by reading the 2026-10 Admin GraphQL reference pages (documentation only, no store contact): `shop` fields, `plan.publicDisplayName` and the deprecated `displayName`, `currentAppInstallation.accessScopes.handle`, and the `locations` arguments and `nodes`, `isActive`, `fulfillsOnlineOrders`, `pageInfo`; record what matches and every difference; mark real-store items as assumptions.
- [ ] 12.2 RED: create `apps/api/src/stores/test-support/fixtures/fixtures-provenance.test.ts`: every fixture file exports `provenance`, a source claim or URL and an assumption note; every S2 fixture is `hand-authored-from-documentation`; a missing tag and a `recorded` tag are rejected (proved with synthetic bad fixtures); the check walks the whole fixtures folder.
- [ ] 12.3 GREEN: create `apps/api/src/stores/test-support/fixtures/fixture-meta.ts` and the fixtures `shop-info.ts` (healthy with plan `Basic`, missing `currencyCode`, `id: 5`), `granted-scopes.ts` (with a duplicate), `locations.ts` (empty `nodes`, 3 active, inactive mix, multi-page cursors, 251 total), `error-bodies.ts` (200 `THROTTLED`, 200 `ACCESS_DENIED` without `requiredAccess`, 401 invalid key, `MAX_COST_EXCEEDED`, `SOMETHING_NEW`, HTML maintenance page, token endpoint bodies), all tagged.
- [ ] 12.4 RED: create `apps/api/src/stores/infrastructure/gateway/graphql-operations.test.ts`: the three query documents match the VS7-checked field lists; the shop query selects `plan { publicDisplayName partnerDevelopment shopifyPlus }` and no deprecated plan `displayName`; the locations query pages by 50 with `includeInactive: false`; each operation declares an estimated cost below 1,000 (about 2, 2 and 52); no document contains an API version literal; the zod schemas parse the fixtures from 12.3 (VS8): healthy shop, scopes with a duplicate, empty `nodes`, multi-page cursors with `hasNextPage` and `endCursor` null on the last page; `currencyCode` absent and `id: 5` fail.
- [ ] 12.5 GREEN: create `apps/api/src/stores/infrastructure/gateway/graphql-operations.ts` and `apps/api/src/stores/infrastructure/gateway/response-schemas.ts`.
- [ ] 12.6 Record VS8 in the apply progress: which fixture shapes parsed, which failed, and the multi-page cursor result.
- [ ] 12.7 U9a gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~240) and record them. Split at 12.3 if needed.

## Phase 13: U9b HTTP gateway operations

Branch `feat/stores-u9b-http-gateway`. Depends on: U9a. Est ~200 lines. Focused: `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/gateway`.
Satisfies: shopify-gateway (port operations, shop info and scopes, locations capped, unknown shapes, request construction). Design D16.

- [ ] 13.1 RED: create `apps/api/src/stores/infrastructure/gateway/http-shopify-gateway.test.ts` with the scripted fetch and fixtures: `getShopInfo` maps `planName` from `publicDisplayName` `Basic` and returns `id`, `name`, `myshopifyDomain`, `currencyCode`, `shopifyPlus`, `partnerDevelopment`; absent `currencyCode` and `id: 5` give `INVALID_RESPONSE`; `getGrantedScopes` returns `write_products`, `read_locations` from `write_products`, `read_locations`, `write_products`; a recorded call is a POST with the three headers and a JSON body and the token appears nowhere else; the URL carries `2027-01` when configured; `apiVersionUsed` is returned; two connections with different domains and tokens run concurrently and each request goes to its own domain with its own token; each read declares `retry: 'safe'`.
- [ ] 13.2 GREEN: create `apps/api/src/stores/infrastructure/gateway/http-shopify-gateway.ts` (`getShopInfo`, `getGrantedScopes`; `listLocations` stub completed in 13.4).
- [ ] 13.3 RED: create `apps/api/src/stores/infrastructure/gateway/http-shopify-gateway-locations.test.ts`: 3 active locations give 3 and `truncated` false; exactly 250 gives 250 and false; 251 gives 250 and true and paging stops once 251 active locations are seen; one inactive and two active gives the two (defensive filter); output sorted by name then id whatever the server order; multiple pages of 50 are followed by cursor until `hasNextPage` is false; an empty `nodes` gives an empty list; a page failure surfaces its kind.
- [ ] 13.4 GREEN: create `apps/api/src/stores/infrastructure/gateway/locations-paging.ts` and complete `listLocations` in `apps/api/src/stores/infrastructure/gateway/http-shopify-gateway.ts`.
- [ ] 13.5 U9b gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~200) and record them.

## Phase 14: U10 Gateway contract suite

Branch `feat/stores-u10-contract-suite`. Depends on: U6b, U9b. Est ~260 lines. Focused: `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/gateway/gateway-contract.int.test.ts src/stores/test-support`.
Satisfies: shopify-gateway (shared contract suite: same result, same error kind, fixture provenance). Design Testing Strategy.

- [ ] 14.1 RED: create `apps/api/src/stores/infrastructure/gateway/gateway-contract.int.test.ts` calling one parameterized suite twice, over the simulator and over the HTTP adapter with scripted fetch and fixtures. Cases (equal results, equal `ShopifyGatewayError.kind`): healthy shop (shop info, scopes and locations equal); missing scope; authentication failure; throttled first attempt then success (both end with the same value: the HTTP adapter retries internally, the simulator throws once and succeeds on the second call through a shared retry-on-retryable helper, `retryable` true on the first failure); server error; network failure; timeout; invalid response; two stores at once. Confirm at CP5 how this case is defined.
- [ ] 14.2 GREEN: create `apps/api/src/stores/test-support/gateway-contract-suite.ts` (the suite function, scenario table and per-adapter scripts) and wire both adapters in the int test.
- [ ] 14.3 Mutation sanity: temporarily change one classification (for example 429 to `SERVER_ERROR`) and one simulator output, confirm the suite fails for each, then revert both changes.
- [ ] 14.4 U10 gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~260) and record them (checkpoint CP5).

## Phase 15: U11 Verify store connection and D19

Branch `feat/stores-u11-verify-use-case`. Depends on: U3, U5b, U10. Est ~340 lines (near budget; pre-agreed cut after 15.5). Focused: `pnpm --filter @importer/api exec vitest run src/stores/application src/stores/infrastructure/persistence`.
Satisfies: store-verification (all requirements except the README disclosure). Design D17, D19, Verification mechanism.

- [ ] 15.1 Create `apps/api/src/stores/application/stores.tokens.ts` (Symbols for the repository, vault, provider registry, gateway, clock, id generator, secret box, config) and `apps/api/src/stores/application/store-errors.ts` (`StoreNotFoundError`); no behaviour, covered by 15.6.
- [ ] 15.2 RED: modify `apps/api/src/stores/infrastructure/persistence/prisma-store-repository.int.test.ts`: `recordVerification` updates `WHERE id = ? AND credentials_envelope = ?` in one statement and reports whether a row changed; a replaced envelope or deleted store gives zero rows; a persisted snapshot is TEXT that parses as JSON with `locationCount` and no location name or id; a failed verification is persisted (`AUTH_FAILED`, `lastVerifiedAt` set, `shopifyShopId` unchanged); `shopifyShopId` is set when obtained; `apiVersion` is the used version when not null else the requested one (`2027-01` recorded on fall-forward); replacing credentials clears the snapshot.
- [ ] 15.3 GREEN: add `recordVerification` to `apps/api/src/stores/ports/store-repository.port.ts` and `apps/api/src/stores/infrastructure/persistence/prisma-store-repository.ts`.
- [ ] 15.4 RED: create `apps/api/src/stores/application/verification-result.test.ts` (pure assembler): problem `code` equals `kind` except `API_VERSION_MISMATCH` (kind `VERSION_UNSUPPORTED`, params `requested`, `used`) and `CREDENTIALS_UNREADABLE` (kind `AUTH_FAILED`); `CREDENTIAL_EXCHANGE_FAILED` carries `reason`; `SCOPE_MISSING` carries `missing`; at most one `SCOPE_MISSING` problem, the union of the diff and a `listLocations` `SCOPE_MISSING` (`locations`); params hold only strings, numbers or string arrays and never response text, URLs, tokens or messages; a non-null `apiVersionUsed` differing from requested adds the mismatch problem and sets `apiVersion.used`, null yields null and no problem, a matching value no problem; `ok` iff no problems; status from the precedence; the snapshot replaces `locations` with `locationCount`.
- [ ] 15.5 GREEN: create `apps/api/src/stores/application/verification-result.ts`.
- [ ] 15.6 RED: create `apps/api/src/stores/application/verify-store-connection.test.ts` with the simulator, an in-memory repository and a fake vault: healthy store gives `ok` true, no problems, 2 locations, `apiVersion.requested` equal to the configured version; the recorded call order is `getShopInfo`, `getGrantedScopes`, `listLocations`; a stored version `2026-07` with config `2026-10` sends `2026-10` and the stored value is replaced; an unknown store gives not found with zero outbound calls; `scopes.required` equals `write_products`, `write_files`, `write_inventory`, `locations`; scopes lacking `write_files` give one `SCOPE_MISSING` problem with `missing` `write_files`; all handles granted but `listLocations` failing `SCOPE_MISSING` gives one problem with `missing` `locations` and `shop` and `granted` returned; an exchange failing `shop_not_permitted` gives reason `SHOP_NOT_PERMITTED` with no response text; an unreadable envelope makes no outbound call and gives one `AUTH_FAILED` problem with code `CREDENTIALS_UNREADABLE`; `AUTH_FAILED` on `getShopInfo` makes one call and leaves `shop` null, `granted` and `locations` empty and `missing` equal to the full list; `getShopInfo` ok then `getGrantedScopes` `SERVER_ERROR` returns `shop`, never calls `listLocations`, one `SERVER_ERROR` problem; each of the 13 kinds injected returns `ok` false and never throws; fall-forward `2027-01` gives `API_VERSION_MISMATCH`, a matching or missing header gives none; the result is persisted with the mapped status and `checkedAt` from the injected clock (ISO 8601 UTC); `shopDomain`, `displayName` and credentials are untouched; when `recordVerification` reports zero rows the result is returned, not persisted, and `store_verification_discarded` is logged with declared field names only.
- [ ] 15.7 GREEN: create `apps/api/src/stores/application/verify-store-connection.use-case.ts`.
- [ ] 15.8 U11 gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~340, near budget) and record them. Report any overrun, never trim; split at 15.5 if needed.

## Phase 16: U12 Store use cases

Branch `feat/stores-u12-store-use-cases`. Depends on: U3, U4, U5b. Est ~330 lines (pre-agreed cut after 16.6). Focused: `pnpm --filter @importer/api exec vitest run src/stores/application`.
Satisfies: store-registry (all requirements), credential-provider (cache dropped on replace and delete), store-endpoints (unknown stores, GET side-effect free), secret-protection (envelope only after create). Design D1, D5, D8.

- [ ] 16.1 RED: create `apps/api/src/stores/infrastructure/random-uuid-id-generator.test.ts`: ids are UUID v4 strings, two calls differ, the value is lower case.
- [ ] 16.2 GREEN: create `apps/api/src/stores/ports/id-generator.port.ts` and `apps/api/src/stores/infrastructure/random-uuid-id-generator.ts`.
- [ ] 16.3 RED: create `apps/api/src/stores/application/create-store.use-case.test.ts`: a gateway and a `fetch` that fail the test are never called; the result has status `UNVERIFIED`, a generated UUID id, `hasCredentials` true, `createdAt` equal to `updatedAt` from the clock; display names of 1 and 80 characters succeed and an empty, whitespace-only or 81 character name is rejected before persistence; the same name twice with different domains succeeds; `https://DEMO.myshopify.com/admin/products` against an existing `demo.myshopify.com` fails with `StoreAlreadyExistsError` and the row count is unchanged; `other.myshopify.com` succeeds; a repository `DuplicateShopDomainError` from a race maps to `StoreAlreadyExistsError`; an invalid domain gives `StoreDomainInvalidError` carrying the reason code and zero `fetch` calls and no row; invalid credentials give `StoreCredentialsInvalidError`, with domain checked before credentials; the envelope is sealed under `store:<lower case id>:credentials`, starts `sb1.` and the canary appears nowhere in the stored row.
- [ ] 16.4 GREEN: create `apps/api/src/stores/application/create-store.use-case.ts` and extend `apps/api/src/stores/application/store-errors.ts` (`StoreAlreadyExistsError`, `StoreDomainInvalidError`, `StoreCredentialsInvalidError`; fixed messages, no echo).
- [ ] 16.5 RED: create `apps/api/src/stores/application/list-get-store.use-case.test.ts`: list is ordered by `createdAt` ascending then `id`; get returns the summary with the 12 fields only (an unverified store has null verification fields) and `hasCredentials` as the only credential signal, with no canary, no `sb1.` and no secret mask or length; both with a `SecretBox` spy, gateway spy and repository write spy see zero calls and the row is byte-identical including `updatedAt`; an unknown UUID and the malformed id `not-a-uuid` both give `StoreNotFoundError` and the malformed one never reaches the repository.
- [ ] 16.6 GREEN: create `apps/api/src/stores/application/list-stores.use-case.ts`, `apps/api/src/stores/application/get-store.use-case.ts` and `apps/api/src/stores/application/store-summary.ts`.
- [ ] 16.7 RED: create `apps/api/src/stores/application/replace-credentials.use-case.test.ts`: a `CONNECTED` store with a snapshot becomes `UNVERIFIED` with the four verification fields null; kind `static_token` to `client_credentials` changes `authKind`; `id`, `displayName`, `shopDomain`, `createdAt` unchanged and `updatedAt` not earlier; no outbound call; `forget(id)` is called so the next token request exchanges again; the new envelope is sealed under the same store context; invalid credentials change nothing; unknown and malformed ids give `StoreNotFoundError`; the output after replace contains neither the old nor the new canary.
- [ ] 16.8 GREEN: create `apps/api/src/stores/application/replace-credentials.use-case.ts`.
- [ ] 16.9 RED: create `apps/api/src/stores/application/delete-store.use-case.test.ts`: the row is removed and a following read reports not found; `forget(id)` is called and no cached token remains; the same domain can be created again with a new id; an unknown id and a malformed id report not found; no envelope for the store remains.
- [ ] 16.10 GREEN: create `apps/api/src/stores/application/delete-store.use-case.ts`.
- [ ] 16.11 U12 gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~330) and record them. Report any overrun, never trim; split at 16.6 if needed.

## Phase 17: U13a Controller, filter, module, wiring

Branch `feat/stores-u13a-controller-module`. Depends on: U11, U12. Est ~260 lines (pre-agreed cut after 17.2). Focused: `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/http src/stores/stores.module.test.ts src/local-security/no-test-route-ships.test.ts`.
Satisfies: store-endpoints (routes and statuses, create validation, no-store, ApiError codes and fixed messages). Design D20, D21 (filter side), HTTP layer table.

- [ ] 17.1 RED: create `apps/api/src/stores/infrastructure/http/stores-exception.filter.test.ts`: `StoreNotFoundError` gives 404 `STORE_NOT_FOUND` with `Store not found.`; domain invalid 400 `The shop domain is not valid. Use the myshopify.com domain of the store.`; already exists 409 `A store with this domain already exists.`; credentials invalid 400 `The credentials are not valid.`; request invalid 400 `The request is not valid.`; a body-parser error (status 400, type `entity.parse.failed`) gives `STORE_REQUEST_INVALID` without the parser message; any other error gives 500 with the generic Nest body (no message, no stack) and logs only `{ event: 'store_request_failed', errorName }`; every response carries `Cache-Control: no-store`; two different invalid domains give identical bodies; no body echoes the submitted domain or a token.
- [ ] 17.2 GREEN: create `apps/api/src/stores/infrastructure/http/stores-exception.filter.ts`.
- [ ] 17.3 RED: create `apps/api/src/stores/infrastructure/http/stores.controller.test.ts` with fake use cases: `POST api/stores` 201 with the summary; `GET api/stores` 200 with `{ stores }`; `GET api/stores/{id}` 200; `POST api/stores/{id}/verify` 200 with the result also when `ok` is false and with no body; `PUT api/stores/{id}/credentials` 200; `DELETE api/stores/{id}` 204 with an empty body; malformed JSON, an extra field, an `id` field, wrong types and an 81 character name give `STORE_REQUEST_INVALID`; domain `myshopify.com.evil.example` gives `STORE_DOMAIN_INVALID`; a 7 character `accessToken` gives `STORE_CREDENTIALS_INVALID`; a body with both an invalid domain and invalid credentials gives `STORE_DOMAIN_INVALID`; zod issues are never returned or logged; a malformed `{id}` is answered like an unknown one before any use case call; `Cache-Control: no-store` on success, error and 204.
- [ ] 17.4 GREEN: create `apps/api/src/stores/infrastructure/http/stores.controller.ts` and `apps/api/src/stores/infrastructure/http/store-request-parsing.ts`.
- [ ] 17.5 RED: create `apps/api/src/stores/stores.module.test.ts`: `StoresModule.forRoot(config, persistence, { secretBox, logger, overrides? })` registers `StoresController` and the six use cases; the box is provided as `useValue` under `SECRET_BOX` (same instance); the default gateway is the HTTP adapter with the configured API version and an injected fetch function; an override replaces the gateway (the simulator) and the fetch function; the module has no environment access.
- [ ] 17.6 GREEN: create `apps/api/src/stores/stores.module.ts` (explicit `@Inject` tokens, `useFactory` wiring).
- [ ] 17.7 RED: modify `apps/api/src/local-security/no-test-route-ships.test.ts`: the graph `AppModule.forRoot` builds has six imports and the controllers `HealthController`, `WorkbookController`, `StoresController`; the test passes `secretBox` and a `LoggerPort`.
- [ ] 17.8 GREEN: modify `apps/api/src/app.module.ts` to import `StoresModule.forRoot` with the box, the logger and an optional test-only `storeOverrides` option, and modify `apps/api/src/main.ts` to forward a test-only `storeOverrides` option exactly like `extraModules` (production `run()` never passes it).
- [ ] 17.9 U13a gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~260) and record them. Split at 17.2 if needed.

## Phase 18: U13b HTTP integration tests and the D21 decision

Branch `feat/stores-u13b-http-int`. Depends on: U13a. Est ~220 lines. Focused: `pnpm --filter @importer/api exec vitest run src/stores/infrastructure/http`.
Satisfies: store-endpoints (routes, validation, unknown stores, origin guard, GET side effects, no-store), secret-protection (bound after boot, single keyring). Design D21, VS9.

- [ ] 18.1 Verify VS9: create `apps/api/src/stores/infrastructure/http/stores-body-parsing.int.test.ts` with a real Nest app on an ephemeral loopback port: malformed JSON on `POST api/stores` with a canary in the body; record whether the body-parser error reaches the controller-scoped filter, the response (400 `STORE_REQUEST_INVALID`, no parser message), and every log line (no body text). Decision rule: if it does not reach the filter, run 18.4.
- [ ] 18.2 RED: create `apps/api/src/stores/infrastructure/http/stores.int.test.ts` (real Nest app, simulator gateway, migrated sandbox database, `DeferredSecretBox` bound over a test keyring, `fetch` on an ephemeral loopback port): create 201 then list 200 with one; verified store with all scopes gives 200 `ok` true and the store reads `CONNECTED` with `locationCount` and no location name; credentials the simulator rejects give 200 `ok` false with an `AUTH_FAILED` problem; delete 204 with empty body and then `GET` 404; replace 200 with `UNVERIFIED`; `myshopify.com.evil.example` 400 `STORE_DOMAIN_INVALID` and no row; 7 character token 400 `STORE_CREDENTIALS_INVALID`; malformed JSON, extra field and 81 character name 400 `STORE_REQUEST_INVALID`; invalid domain plus invalid credentials gives the domain code; duplicate `demo` against `demo.myshopify.com` 409; unknown UUID gives 404 `STORE_NOT_FOUND` on all four id routes with zero gateway calls and `not-a-uuid` gives a byte-identical response; foreign `Origin: https://evil.example` on the four write routes gives 403 `ORIGIN_NOT_ALLOWED` with zero handler, repository and gateway calls and an unchanged table; no `Origin` with `Sec-Fetch-Site: cross-site` on verify gives 403; an allow-listed origin is processed; GET routes with spies on gateway and `SecretBox` make zero calls and leave the row byte-identical; GET with a foreign Origin gives 200 with no canary or envelope; a disallowed Host gives 403 `HOST_NOT_ALLOWED`; `Cache-Control: no-store` on 201, 200, 204, 400, 404, 409 and on the guard's 403.
- [ ] 18.3 GREEN: fix any gap 18.2 finds in the controller or filter; if the guard's 403 lacks `Cache-Control: no-store`, modify `apps/api/src/local-security/local-request.filter.ts` and `apps/api/src/local-security/local-request.filter.test.ts` (flag it in the apply progress as the one edit outside the stores module).
- [ ] 18.4 Conditional on 18.1 (fallback D21): only if the body-parser error does not reach the filter, create the app with `bodyParser: false` in `apps/api/src/main.ts` and add a bounded 16 KB JSON reader for the store routes in `apps/api/src/stores/infrastructure/http/bounded-json-body.ts`, test-first with its test file `apps/api/src/stores/infrastructure/http/bounded-json-body.test.ts`; otherwise record "not needed".
- [ ] 18.5 RED: create `apps/api/src/stores/infrastructure/http/stores-boot.int.test.ts` using the real `bootstrap()` on a migrated sandbox (isolated environment, temporary data directory and key directory, loopback, port 0, `storeOverrides` with the simulator): a store is created and verified through the HTTP routes with the reconciled key; a decrypted canary printed through the application logger is `[REDACTED]`; a database at the baseline only aborts startup with `MIGRATION_REQUIRED`.
- [ ] 18.6 GREEN: make the wiring changes 18.5 needs (if any) in `apps/api/src/main.ts` or `apps/api/src/stores/stores.module.ts`; record the result (checkpoint CP6).
- [ ] 18.7 U13b gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~220) and record them.

## Phase 19: U14 Canary suite, log fields, README, spec deltas

Branch `feat/stores-u14-canaries-readme`. Depends on: U13b. Est ~280 lines (watch; pre-agreed cut after 19.8). Focused: `pnpm --filter @importer/api exec vitest run src/stores`.
Satisfies: store-endpoints (no secret in logs, errors, responses or storage; local API authentication limitation documented), store-registry (no credential in any output), store-verification (disclosure), runtime-configuration (no second version source), shop-domain-guard (suffix not configurable). Design D6, D20, D23, VS10.

- [ ] 19.1 RED: create `apps/api/src/stores/test-support/canaries.test.ts`: the five distinct canaries (static token, client secret, exchanged token, `shpat_` followed by 32 hex characters, a `Bearer` string); the scanners find a canary in a string, a thrown error message, an own property, a nested `cause` chain and file bytes; clean inputs pass.
- [ ] 19.2 GREEN: create `apps/api/src/stores/test-support/canaries.ts`.
- [ ] 19.3 RED: create `apps/api/src/stores/infrastructure/store-log-fields.test.ts`: the declared field names are exactly `storeId`, `shopDomain`, `authKind`, `expiresAt`, `kind`, `reason`, `attempt`, `delayMs`, `status`, `durationMs`, `errorName`; `isSecretKeyName` is false for each; none contains `authorization`, `cookie`, `token`, `secret`, `password`, `signature` or `credential`; `hasCredentials` is not a log field.
- [ ] 19.4 GREEN: create `apps/api/src/stores/infrastructure/store-log-fields.ts`.
- [ ] 19.5 RED: create `apps/api/src/stores/infrastructure/http/stores-canary.int.test.ts` (real app, sandbox database, logger sink at `debug`): seed the five canaries through create, verify success, verify for every gateway failure kind (simulator faults and scripted HTTP error bodies that echo canaries, including a token endpoint body echoing the client secret), replace and delete; scan the sink lines, every response body and header, every thrown error (message, own properties, full cause chain) and the raw bytes of the database file and its WAL; no canary appears anywhere; request bodies are not logged on accepted and on rejected requests; every logged field name belongs to the declared set; every column of every table holds no canary and the envelope column starts `sb1.`; a swapped envelope reports unreadable with zero outbound calls; an envelope under another context fails `DECRYPT_FAILED`; the envelope is gone after delete.
- [ ] 19.6 GREEN: fix every leak the suite finds (record each in the apply progress) and keep log calls on declared field names.
- [ ] 19.7 RED: create `apps/api/src/stores/infrastructure/http/stores-leak-surfaces.int.test.ts` (VS10): a repository that throws an error whose message carries a canary gives a generic 500 body and a log line with only `event` and `errorName`; a real unique violation and a failing fetch carrying a canary in its URL leave no canary in logs, bodies or error chains; record whether Prisma and undici failure messages carry parameter values.
- [ ] 19.8 GREEN: fix any surface 19.7 finds; record VS10 (what the Prisma and undici messages contained and what the D20 filter hid).
- [ ] 19.9 RED: create `apps/api/src/stores/stores-source-scan.test.ts`: in non-test stores sources the global `fetch` is referenced only by the transport and the module's injected default; no API version literal outside tests and fixtures; no `process.env` and no configurable suffix; no `Date.now`, `setTimeout` or `Math.random` outside the runtime defaults; no `console` call; no error class assigns `cause`; no Spanish text (proved first with a temporary offender, then removed). Also confirm the existing configuration tests for the default, malformed and out-of-set versions pass unchanged under `apps/api/src/config` (read-only).
- [ ] 19.10 GREEN: fix any offender the scan finds.
- [ ] 19.11 RED: create `apps/api/src/stores/test-support/readme-disclosure.test.ts` reading `README.md` (read-only): the limitations section states that the local API has no authentication and any local process can create, replace or delete store credentials (only Host and Origin guards apply) and that the set of redacted secret values grows during the process life; the section "Qué se verificó y qué no" states that nothing was verified against a real Shopify store and lists the unverified items (throttling, access denied, bad token, version fall-forward, client-credentials errors, granted scope strings, plan values, `locations` limits, rename redirects) with the live smoke test planned for a later slice; the key backup note mentions real credentials; no fixture is tagged `recorded`.
- [ ] 19.12 GREEN: modify `README.md` (Spanish, neutral register): fix the introduction and the `SHOPIFY_API_VERSION` row that say nothing connects to Shopify and the version is only stored; add the limitations above; rewrite "Qué se verificó y qué no" (nothing verified against a real store, with the unverified list and the planned smoke test); extend the key backup note (it now protects real credentials) and the "Estructura" listing with the stores module.
- [ ] 19.13 Reconcile the delta specs: edit the files under `openspec/changes/shopify-importer-03-stores-and-shopify-gateway/specs/` only where apply found a divergence (VS7 field names, the VS9 parser path, the contract-suite throttled-then-success definition, the guard header edit), listing each edit in the apply progress; confirm the RENAMED header in `secret-protection` and the MODIFIED headers in `runtime-configuration` still match the main specs `openspec/specs/secret-protection/spec.md` (read-only) and `openspec/specs/runtime-configuration/spec.md` (read-only) so archive can merge them, and note the warning for archive.
- [ ] 19.14 U14 gate: run the focused test command and `pnpm check`; measure hand-written lines (budget 400, planned ~280) and record them. Report any overrun, never trim; split at 19.8 if needed.

## Phase 20: Final verification gate (rides on the U14 PR)

Docs: the design lists the README only; no other documentation file is touched.

- [ ] 20.1 Confirm in the apply progress that the only documentation edits are `README.md` (Spanish, neutral) and the delta spec reconcile of 19.13, and that no `.env*` or key file was read or written.
- [ ] 20.2 Run `pnpm install --frozen-lockfile`; confirm exit 0 and the lockfile unchanged (no new dependency).
- [ ] 20.3 Run `pnpm check` (typecheck, lint, format check, tests, including the existing configuration tests for the pinned API version); confirm all exit 0.
- [ ] 20.4 Run `pnpm build`; confirm exit 0, that the API dist holds no `test-support` output, no fixtures and no probe files, and that the simulator is present (design D22).
- [ ] 20.5 Leftovers check: no `.only` or `.skip` in tests, no temporary lint-gate file from 2.2, no scratch or downloaded files inside the repository, no probe or temporary mutation from 14.3 and 19.9, no fixture tagged `recorded`, no API version literal in stores sources outside tests and fixtures, no `process.env` in the stores module, no Spanish text in API source.
- [ ] 20.6 Confirm no network call exists in runtime code outside the transport: search the stores source for `fetch`, `http`, `https`, `net` and `undici` and list each hit (only the transport call site and the module's injected default reference); confirm no task contacted Shopify.
- [ ] 20.7 Run the canary suite of 19.5 and 19.7 and record the results: zero canary hits across logs, responses, headers, thrown error chains, database bytes and WAL for create, verify (success and every kind), replace and delete.
- [ ] 20.8 Honest statement check: confirm the README, the apply progress and the final report all state that no behaviour was verified against a real Shopify store, list the unverified items, and that every fixture is tagged `hand-authored-from-documentation`.
- [ ] 20.9 Orchestrator-run harness (not an apply task; apply agents must not boot the app): from a temporary clone of the merged chain, with `env -i`, a temporary HOME and data directory, a key directory with mode 700, a migrated database (`pnpm db:migrate` against the temporary data directory), loopback and an ephemeral port: boot the app; `GET health` is ok; `curl` create with canary credentials gives 201 `UNVERIFIED`; list and get work; foreign Origin gives 403; malformed JSON gives 400 `STORE_REQUEST_INVALID`; replace gives 200; delete gives 204; never call `verify` (it would contact the real Shopify host); then scan the captured log and the database bytes for canaries and check the envelope starts `sb1.`; also start once against a baseline-only database and confirm `MIGRATION_REQUIRED`. Never run it from the real repository or the real HOME.
- [ ] 20.10 Walk the proposal success criteria and tick each with its evidence in the apply progress (classification table, contract suite on both adapters, rejected domains and redirects, throttle and retry tests, token cache, canary results, origin guard on all write routes, green gates).

## Coverage Table (61 requirements, 209 scenarios)

| Capability: Requirement | Scenarios | Tasks |
|---|---|---|
| store-registry: Store record and statuses | 3 | 1.8, 1.9, 3.14, 3.15, 16.5, 16.6 |
| store-registry: Create is offline and starts UNVERIFIED | 3 | 1.8, 2.13, 2.14, 16.3, 16.4, 17.3, 18.2 |
| store-registry: Display name length | 3 | 1.8, 1.9, 16.3, 16.4, 18.2 |
| store-registry: Unique canonical domain | 2 | 3.3, 3.14, 3.15, 16.3, 16.4, 18.2 |
| store-registry: Replacing credentials resets verification | 3 | 2.13, 2.14, 3.14, 3.15, 16.7, 16.8, 18.2 |
| store-registry: Hard delete | 3 | 3.14, 3.15, 16.9, 16.10, 18.2 |
| store-registry: No credential or envelope in any output | 2 | 16.5, 16.6, 16.7, 16.8, 19.5, 19.6 |
| credential-provider: Two credential kinds | 4 | 1.6, 1.7, 16.3, 16.4 |
| credential-provider: Encrypted envelope bound to the store | 4 | 4.6, 4.7, 9.4, 9.5, 19.5 |
| credential-provider: Client-credentials exchange request | 4 | 8.1, 8.2, 4.8, 4.9 |
| credential-provider: Token cache and refresh margin | 3 | 9.2, 9.3 |
| credential-provider: Single-flight exchange | 3 | 9.2, 9.3 |
| credential-provider: Forced refresh on authentication failure | 4 | 9.2, 9.3, 11.5, 11.6 |
| credential-provider: Exchange failures classified from opaque bodies | 4 | 8.3, 8.4 |
| credential-provider: Token cache memory only and registered for redaction | 3 | 4.6, 4.7, 8.1, 9.2, 9.4, 16.7, 16.9 |
| shop-domain-guard: Accepted input forms and canonical result | 4 | 2.7, 2.8 |
| shop-domain-guard: Handle grammar | 4 | 2.7, 2.8 |
| shop-domain-guard: Syntax rejections | 6 | 2.5, 2.6 |
| shop-domain-guard: Host rejections and fixed suffix | 5 | 2.7, 2.8, 19.9, 19.10 |
| shop-domain-guard: URLs built only from the validated domain | 3 | 7.4, 7.5, 5.3, 5.4 |
| shop-domain-guard: Redirects refused and rejected hosts never reach fetch | 3 | 7.3, 7.6, 7.7, 16.3, 16.4, 18.2 |
| shopify-gateway: Read-only port with three operations | 2 | 5.3, 5.4, 13.1, 13.2 |
| shopify-gateway: Shop info and granted scopes results | 3 | 12.3, 12.4, 12.5, 13.1, 13.2 |
| shopify-gateway: Locations are capped at 250 | 4 | 6.1, 6.2, 13.3, 13.4 |
| shopify-gateway: Simulated gateway with injectable faults | 3 | 6.1 to 6.4 |
| shopify-gateway: Shared contract suite | 3 | 12.2, 12.3, 14.1 to 14.3 |
| shopify-gateway: Typed gateway error without raw data | 3 | 5.1, 5.2, 7.6, 7.7, 19.5 |
| shopify-gateway: Classification by HTTP status | 4 | 10.1, 10.2 |
| shopify-gateway: Classification of errors inside a 200 response | 5 | 10.3, 10.4 |
| shopify-gateway: Unknown shapes never escape as raw errors | 3 | 10.1 to 10.4, 12.4, 13.1 |
| shopify-gateway: Request construction | 3 | 10.5, 10.6, 13.1, 19.9 |
| shopify-gateway: Transport limits | 5 | 7.6, 7.7, 7.8 |
| shopify-gateway: API version header check | 3 | 10.5, 10.6 |
| shopify-gateway: Cost tracking and throttle tracker | 6 | 10.5, 10.6, 11.1, 11.2, 11.5, 11.6 |
| shopify-gateway: Retry policy for reads | 4 | 11.3, 11.4, 11.5, 11.6 |
| shopify-gateway: Non-retryable kinds and mutations | 3 | 11.3, 11.4 |
| store-verification: Verification flow and result shape | 4 | 1.10, 1.11, 15.6, 15.7 |
| store-verification: Required capability set | 2 | 1.2, 1.3, 15.6 |
| store-verification: Scope diff with write-includes-read | 5 | 2.9, 2.10 |
| store-verification: Problems are typed | 4 | 1.10, 1.11, 15.4 to 15.7 |
| store-verification: Failure handling across the three calls | 3 | 15.6, 15.7 |
| store-verification: Version mismatch is a problem | 3 | 15.4, 15.5, 15.6 |
| store-verification: Status mapping | 4 | 2.11, 2.12, 15.6 |
| store-verification: Snapshot persistence | 4 | 15.2, 15.3, 15.6, 15.7 |
| store-verification: Disclosure that nothing was verified against a real store | 2 | 12.2, 19.11, 19.12, 20.8 |
| store-endpoints: Routes and success statuses | 4 | 17.3, 17.4, 18.2 |
| store-endpoints: Create request validation | 5 | 17.3, 17.4, 18.1, 18.2 |
| store-endpoints: Unknown stores | 2 | 16.5, 16.6, 17.3, 18.2 |
| store-endpoints: Origin guard on every write route | 3 | 17.7, 17.8, 18.2 |
| store-endpoints: GET routes are side-effect free and secret-free | 3 | 16.5, 16.6, 18.2 |
| store-endpoints: No-store caching | 2 | 17.1, 17.2, 18.2, 18.3 |
| store-endpoints: New ApiError codes and fixed messages | 3 | 1.12, 1.13, 17.1, 17.2 |
| store-endpoints: No secret in logs, errors, responses or storage | 3 | 19.1 to 19.8, 20.7 |
| store-endpoints: Local API authentication limitation is documented | 2 | 19.11, 19.12 |
| secret-protection: Credentials encrypted at rest per store | 4 | 3.3, 4.6, 4.7, 16.3, 16.9, 19.5 |
| secret-protection: Injectable SecretBox after key reconciliation | 4 | 4.1 to 4.5, 18.5, 18.6 |
| persistence-baseline: Store table migration | 3 | 3.1 to 3.5 |
| persistence-baseline: Unique canonical domain constraint | 2 | 3.3, 3.4, 3.14, 3.15 |
| persistence-baseline: Credentials only as an envelope column | 2 | 3.3, 3.14, 19.5 |
| persistence-baseline: Startup check covers every expected table | 4 | 3.6 to 3.12, 18.5 |
| runtime-configuration: Pinned Admin API version | 5 | 10.5, 10.6, 13.1, 19.9, 20.3 |

Per-capability totals (requirements, scenarios): store-registry 7, 19; credential-provider 8, 29; shop-domain-guard 6, 25; shopify-gateway 15, 54; store-verification 9, 31; store-endpoints 9, 27; secret-protection 2, 8 (the renamed and modified requirement count once); persistence-baseline 4, 11; runtime-configuration 1, 5. Total: 61 requirements, 209 scenarios; none orphaned.

Task total: 176 checkbox tasks. Per phase: Phase 1 (U1) 15, Phase 2 (U2) 16, Phase 3 (U3) 16, Phase 4 (U4) 10, Phase 5 (U6a) 5, Phase 6 (U6b) 5, Phase 7 (U7a) 9, Phase 8 (U5a) 5, Phase 9 (U5b) 6, Phase 10 (U7b) 7, Phase 11 (U8) 7, Phase 12 (U9a) 7, Phase 13 (U9b) 5, Phase 14 (U10) 4, Phase 15 (U11) 8, Phase 16 (U12) 11, Phase 17 (U13a) 9, Phase 18 (U13b) 7, Phase 19 (U14) 14, Phase 20 (final gate) 10.

Design items to verify (VS): VS1 7.3, VS2 7.6 and 7.8, VS3 7.6 and 7.8, VS4 3.5, VS5 3.14, VS6 4.3, VS7 12.1, VS8 12.4 and 12.6, VS9 18.1, VS10 19.7 and 19.8.

Open points carried to apply (not blockers): (1) the design D20 answers Nest's generic 500 body because `ApiError` has no internal-error code; confirm or add a code (1.1). (2) The store-endpoints spec asks every store response, including the guard's 403, to carry `Cache-Control: no-store`; if the existing guard filter does not, 18.3 edits `apps/api/src/local-security/local-request.filter.ts`. (3) The throttled-then-success contract case cannot be literally equal for the simulator (no retry) and the HTTP adapter (retries): 14.1 defines it through a shared retry helper; confirm at CP5. (4) The transport returns status, headers and a flagged body and throws only for timeout and network, because the classification table checks status before body; this refines the design wording. (5) `storeOverrides` is a test-only seam in `AppModule` and `bootstrap()` (like `extraModules`) that the design does not list; production never passes it. (6) The orchestrator harness never calls `verify` because it would contact a real Shopify host. (7) A check that `shop.myshopifyDomain` equals the stored domain is not adopted (design); S4 may revisit.
