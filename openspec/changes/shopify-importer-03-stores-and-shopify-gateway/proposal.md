# Proposal: Stores and Shopify Gateway (S2)

S2 lets the operator register Shopify stores with encrypted credentials and verify each connection through a read-only Admin GraphQL gateway. It writes nothing to Shopify.

## Intent

Every later slice (tier B checks in S4, imports in S5) needs a trusted store record, a safe way to obtain an Admin API token, and one gateway that classifies Shopify failures. Today the API has no store table, no injectable `SecretBox`, and never calls Shopify. New legacy custom apps can no longer be created (research C19), so S2 must support the Dev Dashboard client credentials grant as well as existing static tokens.

## Inputs

| Kind | Item |
|---|---|
| Confirmed | D1 option 1 and Q3 to Q12 defaults (`state.yaml`, preproposal revision 2, 2026-10-14) |
| Evidence | `exploration.md` (current state, F1 to F13, design sketch); `research.md` revision 2 (claims C1 to C21; undocumented items deferred to design assumptions and the live smoke test) |

## Scope

### In Scope
- Contracts: store schemas, `StoreVerification`, gateway error kinds, required scope set, new `ApiError` codes.
- `Store` model, second migration, repository, startup table check.
- Injectable `SecretBox` (lazy holder), credential envelope per store, `CredentialProvider` with `static_token` and `client_credentials`.
- `ShopDomain` value object and SSRF guard.
- `ShopifyGateway` port with three reads (shop info, granted scopes, locations), simulated gateway, own thin GraphQL HTTP client, `ThrottleTracker`, retry policy, error classification.
- `VerifyStoreConnection` and store use cases; routes under `api/stores`.
- No-leak and origin-guard tests; README limitation edits.

### Out of Scope
- No web screens, store picker or Spanish copy (S6); no connection guide (S7).
- No product writes, mutations or staged uploads (S5); no file uploads (S3, S5).
- No OAuth authorization code flow (later adapter behind the same port).
- No tier B lookups (`findProductByHandle`, `findProductByCustomId`, file status) (S4).
- No persistence of locations (only a count); no per-store concurrency limiter (S5).
- No live smoke test against a real store (S7 by default, Q12).
- No new environment variables (limits are code constants, Q8).

## Capabilities

### New Capabilities
- `store-registry`: store record, lifecycle (create UNVERIFIED, replace credentials, hard delete), statuses, unique canonical domain.
- `credential-provider`: two credential kinds, encrypted envelope bound to `store:<id>:credentials`, token cache and refresh for client credentials.
- `shop-domain-guard`: accepted input forms, canonical `<handle>.myshopify.com`, rejection rules, fixed URL construction, redirect refusal.
- `shopify-gateway`: read port, error taxonomy, simulator, HTTP client, cost tracking, throttling and retry policy, response caps.
- `store-verification`: verification use case, scope diff with write-implies-read, status mapping, snapshot, API version check.
- `store-endpoints`: HTTP routes, status codes, `ApiError` codes, `no-store` caching, no secret in any response.

### Modified Capabilities
- `secret-protection`: requirement "No credential persistence in S0" is replaced by encrypted-at-rest store credentials (envelope only, context-bound, no plaintext column); `SecretBox` becomes injectable after key reconciliation.
- `runtime-configuration`: requirement "Pinned Admin API version" drops "it is never used to call Shopify"; the value is now the version on every Admin API call.
- `persistence-baseline`: existing requirements unchanged in wording; ADDED requirements for the second (store) migration and a startup check that refuses to run when any expected table is missing.
- `local-security-baseline` and `health-check`: no change. The origin guard already covers future write routes; the health body is unaffected.

## Approach

Approach A from the exploration.

| Topic | Decision |
|---|---|
| Module | One `stores` module (Q11) with domain, application, ports, infrastructure; S1 layout; gateway ports inside |
| Credentials | `static_token` (one secret) and `client_credentials` (client id and secret, exchanged for a 24 h token, C10); in-memory cache, refresh before expiry, single-flight, one forced refresh on `AUTH_FAILED` |
| Secrets wiring | `SECRET_BOX` token whose implementation is bound in boot after `reconcileKey`, mirroring `registerKeyring`; decrypted values registered with the redactor |
| Store model | Table `store`: id, display name, canonical domain (unique), Shopify shop id, API version, auth kind, envelope, status, last verification (JSON as TEXT), timestamps |
| Domain guard | Handle, `handle.myshopify.com`, or pasted URL (host only); custom domains and admin store URLs rejected (Q5); URL built from the handle with fixed scheme, suffix and path; `redirect: 'error'` |
| Client | Own thin client on global `fetch` (injected): 15 s timeout, 2 MB cap, content-type and zod parsing, token only in header |
| Throttling | `ThrottleTracker` (pure, injected clock) trusts `extensions.cost.throttleStatus`; retry for reads only, 3 attempts, backoff from 1 s with jitter; mutations typed `retry: 'none'` |
| Classification | THROTTLED is HTTP 200 with `extensions.code` THROTTLED (C6); missing scope is 200 with ACCESS_DENIED (C8); bad or expired token is 401 (C9); plus SHOP_UNAVAILABLE, QUERY_TOO_COSTLY (C5), SERVER_ERROR, NETWORK, TIMEOUT, INVALID_RESPONSE, GRAPHQL_ERROR, CREDENTIAL_EXCHANGE_FAILED (`shop_not_permitted`, C11) |
| API version | Pinned `2026-10` from config (Q6, C3); the `X-Shopify-API-Version` response header is compared with the request; a mismatch signals fall-forward (C1, C2); stale stored version re-verified on demand (Q10) |
| Scopes | Required set is a contracts constant: `write_products`, `write_files`, `write_inventory`, locations by any of three scopes (Q7); write implies read (C14) |
| Verification | Two steps: create (no outbound call) then verify (Q4); returns 200 with `ok` and typed problems; locations live, capped at 250 with `truncated` (Q9) |
| Routes | `POST api/stores`, `GET api/stores`, `GET api/stores/{id}`, `POST api/stores/{id}/verify`, `PUT api/stores/{id}/credentials`, `DELETE api/stores/{id}` (hard delete, Q3) |

Assumptions (not validated; design marks them and fixtures carry a provenance tag): the JSON bodies of THROTTLED, ACCESS_DENIED and 401; presence of `Retry-After`; status and body on version fall-forward; handle grammar and rename redirects; client-credentials error statuses and bodies; `locations` page size and its required scope; the scope of `stagedUploadsCreate`.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `packages/contracts/src/` | New/Modified | Store schemas, verification, error kinds, scope set; `ApiError` enum extended |
| `packages/contracts` `api-error` test and the web `ApiError` codes test | Modified | Closed enum lists new codes |
| `apps/api/src/stores/` | New | Module, domain, use cases, ports, adapters, controller, simulator |
| `apps/api/prisma/` schema and migrations | New/Modified | `Store` model, second migration |
| `baseline-migration.int.test.ts`, `PrismaService.connect()` | Modified | Table list and startup table check |
| `apps/api/src/main.ts`, secret-box boot | Modified | Bind `SECRET_BOX` after key reconciliation |
| `apps/api/src/app.module.ts`, `eslint.config.js` | Modified | Wiring; `OTHER_MODULES` entry; purity block for `stores` domain and application |
| README limitations | Modified | Unverified Shopify behaviour; no local API authentication |
| `env.example` | Unaffected | Limits are constants |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Nothing is verified against a real store; classification rests on docs and hand-authored fixtures | High | Provenance-tagged fixtures; shared contract suite (simulator and HTTP adapter); README statement; smoke test in S7 |
| No authentication on the local API: any local process can create, replace or delete credentials | Med | Origin guard on all writes; documented residual risk; not solvable in S2 |
| Secret leak via error causes, validation messages, framework defaults | Med | Fixed messages; causes dropped; canary tests across logs, errors, responses, database row |
| Redaction by key-name substring masks fields such as `credentialKind`; registry of secrets only grows | Med | Naming rule (`authKind`, `expiresAt`); growth documented |
| Boot order change for `SecretBox` | Med | Own unit; tests for unbound use before boot |
| Spec amendments to S0 requirements | Low | Explicit deltas in this change; warn at archive |
| Client credentials only work within the operator's organization (C11) | Med | `static_token` kind; OAuth stays additive |
| Units exceed 400 lines | High | Pre-planned splits (see forecast) |

## Rollback Plan

Revert the chain merges on `develop` in reverse order. The store migration is additive; on rollback, delete the local database file or drop table `store` (stored envelopes are useless without S2 code). The key file and `app_setting` are untouched.

## Dependencies

- S0 archived (secret box, key boot, persistence, origin guard). S1 archived and independent.

## Success Criteria

- [ ] Every classification branch maps a hand-written response to exactly one kind; unknown shapes become `GRAPHQL_ERROR` or `INVALID_RESPONSE`.
- [ ] One contract suite passes against the simulator and the fixture-backed HTTP adapter.
- [ ] Rejected domains (userinfo, port, IP literal, lookalike suffix, Unicode) never reach `fetch`; redirects are refused.
- [ ] Throttle and retry tests with a fake clock: delays, attempt caps, no retry of non-retryable kinds or `retry: 'none'`.
- [ ] Token cache: refresh before expiry, single-flight, one forced refresh.
- [ ] Canary secrets never appear in logs, errors, responses or plaintext in the database; wrong context fails decryption.
- [ ] Foreign `Origin` on every write route returns 403 and the handler does not run.
- [ ] `pnpm test`, typecheck, lint and build exit 0.

Not verified until a development store smoke test: real response bodies and statuses (throttle, access denied, bad token, version fall-forward), client-credentials errors, granted scope strings, plan values, `locations` limits and rename redirects. Success here means the code matches the documentation, not that it works against Shopify.

## Review Workload Forecast

| Item | Value |
|---|---|
| Units | U1 to U14 from the exploration (U5 kept by D1); optional smoke unit moved to S7 |
| Size | About 4,300 authored lines, each unit about 260 to 390, uncertainty about 35 percent |
| Likely splits | U5, U6, U7, U9, U13 |
| Order | U1; U2 and U6 after U1; U3 and U4 after U2; U5 after U4; U7, U8, U9 in sequence after U6; U10 after U9; U11 after U3 and U10; U12 after U3 and U4; U13 after U11 and U12; U14 last |
| Chain strategy | `feature-branch-chain` from `develop`, as in S0 and S1 |

Decision needed before apply: No
Chained PRs recommended: Yes
400-line budget risk: High

## Decisions (confirmed by the user on 2026-10-14)

| ID | Decision |
|---|---|
| D1 | Option 1: `CredentialProvider` with `static_token` and `client_credentials`; OAuth authorization code is a later adapter |
| Q2 | Informational only (which stores first; whether a legacy app exists) |
| Q3 | Removal is a hard delete of row and credentials |
| Q4 | Two steps: create (UNVERIFIED, no outbound call), then verify |
| Q5 | Handle, `handle.myshopify.com` or pasted URL (host only); custom domains and admin store URLs rejected |
| Q6 | API version pinned to `2026-10` (config default) |
| Q7 | Required scope set is a contracts constant; `stagedUploadsCreate` scope stays unverified |
| Q8 | 15 s, 3 attempts, 2 MB, 250 locations are code constants |
| Q9 | Locations live, not persisted; only a count stored |
| Q10 | Stored version different from config is re-verified on demand |
| Q11 | One `stores` module with gateway ports inside |
| Q12 | Live smoke test in S7 unless a development store is available during S2 |
