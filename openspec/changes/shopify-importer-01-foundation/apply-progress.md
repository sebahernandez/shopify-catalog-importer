# Apply Progress: shopify-importer-01-foundation

Mode: U1 and U2 Standard (strict_tdd was false); U3 onward Strict TDD (strict_tdd true).

## Batch 1: U1 Workspace tooling, test runner, contracts base

Branch `feat/foundation-u1-workspace-tooling`. Tasks 1.1 to 1.11 complete (11/11 of Phase 1; 11 of 61 overall).

Resolved versions (exact pins): pnpm 12.11.2, TypeScript 6.0.3, ESLint 10.12.0,
typescript-eslint 8.71.2, Prettier 3.9.10, eslint-config-prettier 10.1.8, Vitest 5.0.4, zod 4.6.7,
@eslint/js 10.0.1, globals 17.13.0, @types/node 24.19.2.

Notes for later units:
- TypeScript is pinned to 6.0.3, not the registry `latest` 7.0.2, because typescript-eslint 8.71.2
  declares peer `typescript >=4.8.4 <6.1.0`.
- pnpm 12 runs `pre*` scripts, so root `predev`, `pretypecheck` and `pretest` build contracts.
- Strict engine check is `engineStrict: true` in `pnpm-workspace.yaml`.
- `tsconfig.base.json` sets `types: ["node"]` (TypeScript 6 no longer includes `@types/*` implicitly).
- Contracts keeps `tsconfig.json` (typecheck, includes tests) and `tsconfig.build.json` (emit, excludes tests).
- Root `prettier --write .` touches `.atl/`; it is now in `.prettierignore`.

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/contracts test`: 3 files passed, 14 tests passed, 2 skipped (web invariants, vacuous until U15) |
| Runtime harness | `pnpm install --frozen-lockfile && pnpm check && pnpm build` from root: all exit 0, lockfile unchanged |
| Rollback boundary | Whole unit; repo returns to the planning artifacts only |

## Batch 2: U2 API skeleton and spikes

Branch `feat/foundation-u2-api-skeleton`. Tasks 2.1 to 2.5 complete (5/5 of Phase 2; 16 of 61 overall). No fallback applied.

Spike outcomes (inputs for CP2 and CP3):

| Spike | Verdict | Evidence |
|---|---|---|
| ESM (item 1) | PASS, no fallback | `nest build` output run with plain `node dist/main.js` on Node 24 booted a Nest 12 app (top-level await) on an ephemeral loopback port. `nest start --watch` compiled, started, and after a source edit recompiled and restarted. The API stays ESM; CP3 needs no CommonJS re-read. |
| DI under Vitest (item 2) | PASS, no plugin | Explicit `@Inject(TOKEN)` resolves with no `emitDecoratorMetadata` (needs `experimentalDecorators` only). Negative control: removing `@Inject` makes the provider arrive undefined and the test fail. |
| Native driver (items 4 and 7) | PASS | `better-sqlite3` 12.11.1 installs via prebuilt binary or local build; `allowBuilds` in `pnpm-workspace.yaml` is required (without it `pnpm add` fails with `ERR_PNPM_IGNORED_BUILDS`). In-memory `SELECT 1` and the adapter factory both work. |

Resolved versions (exact pins): @nestjs/common, @nestjs/core, @nestjs/platform-express 12.1.3, @nestjs/cli 12.0.8,
reflect-metadata 0.2.2, rxjs 7.8.2, better-sqlite3 12.11.1, @prisma/adapter-better-sqlite3 7.10.0,
@types/better-sqlite3 9.6.0. Vitest stays at 5.0.4.

Notes for later units:
- `better-sqlite3` is pinned to 12.11.1 because the adapter depends on `^12.6.0`; registry latest is 13.0.3.
- The API `build` script is `nest build`; `dev` is `nest start --watch`. Nest CLI looks for `dist/main.js`, so U13 must add `main.ts` at the source root.
- `apps/api/tsconfig.json` sets `experimentalDecorators: true`; do not enable `emitDecoratorMetadata` (conflicts with `verbatimModuleSyntax` and is unneeded).
- U2 does not depend on `@importer/contracts` yet; add `workspace:*` when first imported.
- The spike scaffold `main.ts` used for the watch run was removed; U13 owns the real one.

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/api test`: 2 files passed, 4 tests passed |
| Runtime harness | `nest build` then plain `node dist/main.js` boot, and `nest start --watch` edit-restart, both on an ephemeral loopback port, processes stopped |
| Rollback boundary | `apps/api/**` plus the `allowBuilds` lines in `pnpm-workspace.yaml` and the lockfile delta |

## Batch 3: U3 Money

Branch `feat/foundation-u3-money`. Tasks 3.1 to 3.4 complete (4/4 of Phase 3; 20 of 61 overall). Mode: Strict TDD.
Commits: f613b83 (Money value object plus tests), cbf35e8 (MoneyString, cross-check test, contracts dependency).

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|---|---|---|---|---|---|---|---|
| 3.1/3.2 | apps/api/src/shared-kernel/money/money.test.ts | Unit | N/A (new) | Failed: Cannot find module './money.js' | 95/95 passed | Tables: 14 canonical, 1 comma set of 5, 23 malformed, 6 non-string, add, compare, toFixed | Lint autofix only (removed one redundant assertion); tests stayed green |
| 3.3 | packages/contracts/src/money.test.ts | Unit | 14 existing contracts tests green | Failed: Cannot find module './money.js' | 28/28 passed | 9 accepted, 15 rejected, 4 non-string | None needed |
| 3.4 | apps/api/src/shared-kernel/money/money-contract.int.test.ts | Integration | N/A (new) | Failed: Cannot find package '@importer/contracts' | 122/122 passed after adding workspace:* dependency | 13 samples x 2 checks plus a sum | None needed |

### Decisions and deviations

- `MoneyError` carries `AMBIGUOUS_SEPARATOR` and `INVALID_FORMAT` as specified. Two extra codes cover `toFixed` misuse, which tasks.md leaves unnamed: `SCALE_EXCEEDED` and `INVALID_SCALE`.
- A comma input is ambiguous only when the string is made of digits, `.`, `,` and an optional leading `-`; other comma-bearing garbage (for example `a,b`) is INVALID_FORMAT.
- `MoneyString` regex excludes negative zero (`-0`), which the D5 regex literal would accept but the D5 prose forbids. Money never emits `-0`.
- `apps/api` now depends on `@importer/contracts` via `workspace:*` (lockfile +3 lines). `money.ts` itself imports nothing.
- Hand-written size: 503 added lines (tests 352, source 151) against a 400 budget and a ~300 forecast. Not trimmed; reported to the orchestrator.

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/api exec vitest run src/shared-kernel/money`: 2 files passed, 122 tests passed |
| Runtime harness | N/A: pure value object, no runtime boundary. Root `pnpm check` (126 API, 42 contracts tests) and `pnpm build` exit 0 |
| Rollback boundary | shared-kernel/money/**, packages/contracts/src/money*, the index.ts export line, the api dependency line and its lockfile delta |

## Batch 4: U4 redact() and spec alignment

Branch `feat/foundation-u4-redact`. Tasks 4.1 to 4.3 complete (3/3 of Phase 4; 23 of 61 overall). Mode: Strict TDD.
Commits: 067e614 (spec wording), 1b68255 (redact() plus tests).

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|---|---|---|---|---|---|---|---|
| 4.1 | N/A (spec wording only) | N/A | N/A | N/A | Re-read: no scenario uses a bare key name | N/A | N/A |
| 4.2/4.3 | apps/api/src/shared-kernel/logging/redact.test.ts | Unit | N/A (new) | Failed: Cannot find module './redact.js' | 72/72 passed | 16 plus 4 secret key names, 7 preserved names, 3 token prefixes, 8 adversarial inputs, all spec scenarios | Dropped an untested speculative stem; prettier and a Map type annotation only |

Mutation check: removing the longest-first sort failed the overlap test; raising the depth cap failed the deep-structure test.

### Decisions where the design was silent or ambiguous

- Bare `key` is not secret (also protects the `app_setting.key` column). Secret key forms: a name ending in api, private, encryption, access, signing, master or auth plus `key`, after removing `-`, `_` and spaces.
- Secret-named keys: the whole value is replaced, whatever its type, and is never read.
- Error: output is a plain object of name plus all own property names (stack, message, cause, extra fields), each redacted by the same rules. Date: ISO string. Map: array of entries. Set: array. Buffer, typed arrays, ArrayBuffer: a byte-count marker, never content. Class instances: own enumerable properties. toJSON is honoured and its result is redacted. Functions: [Function]. Symbols: redacted description.
- Bounds: depth 12, 10,000 visited nodes and entries; beyond that [Truncated]. Cycle: [Circular] (ancestor path only, so shared references are not flagged).
- Never throws: an unreadable node becomes [Unredactable] (leak-safe) instead of failing the log call.
- API: redact, redactString (for the logger message path), registerSecret (returns false below 8 characters), isSecretKeyName, exported constants, and a clearRegisteredSecretsForTests seam (registry is process-wide).

### What redact() does not catch

Secrets in free text that match no pattern and are not registered; secrets in object keys or Map keys; symbol-keyed properties; key=value pairs in plain text outside URLs; non-Shopify vendor token formats; secrets split across fields or encoded (base64, URL-encoded) unless the encoded form is registered; data past the depth or node caps (dropped, not leaked). Key-name matching over-redacts names containing token, secret and similar (for example max_tokens).

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/api exec vitest run src/shared-kernel/logging/redact`: 1 file, 72 tests passed |
| Runtime harness | N/A: pure function, no runtime boundary. Root `pnpm check` (198 API, 42 contracts tests) exit 0 |
| Rollback boundary | shared-kernel/logging/redact*; the spec wording edit is a separate commit |
| Size | 574 hand-written added lines (source 212, tests 362) against a 400 budget; not trimmed |
