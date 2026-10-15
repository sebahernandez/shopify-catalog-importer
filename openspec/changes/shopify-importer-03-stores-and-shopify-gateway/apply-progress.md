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
