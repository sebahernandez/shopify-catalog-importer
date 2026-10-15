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
