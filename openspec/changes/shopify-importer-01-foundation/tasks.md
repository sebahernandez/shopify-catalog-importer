# Tasks: Foundation for the Shopify Catalog Importer (S0)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~4,000 hand-written (range 3,300 to 4,800; ~50% tests) plus ~9,000 generated (lockfile, migration SQL). Deletions are negligible (~25). |
| 400-line budget risk | High for the change as a whole; Medium for U1, U7 and U12 (340 to 380 each); Low for the rest |
| Chained PRs recommended | Yes |
| Suggested split | 17 stacked work units U1 to U17, each at or under 400 hand-written lines on my estimate (optionally merge U16 + U17 into one PR of ~360) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

The design estimated ~2,700 hand-written lines. This forecast is ~4,000 because it counts package manifests, config files and per-unit scaffolding that the design did not, and because splitting adds some repeated boilerplate. Estimates were not shrunk to fit. A two-PR delivery would carry roughly 3,600 hand-written lines in the second PR, about nine times the budget; a size exception is not credible for hand-written code, so it is not recommended. The user chooses the chain strategy (stacked-to-main, feature-branch-chain, or size-exception).

### Size forecast per work unit

Hand-written = additions authored by hand, tests included. Generated figures are rough (+/- 50%) and are excluded from the 400-line count.

| Unit | Design unit | Scope | Hand-written (src / tests) | Generated | Depends on |
|---|---|---|---|---|---|
| U1 | U1 | Root tooling, README stub, contracts base, test runner | ~380 (320 / 60) | lockfile ~1,800 | none |
| U2 | new | API package skeleton plus ESM, DI and native-module spikes | ~165 (110 / 55) | lockfile ~3,500 | U1 |
| U3 | U2 (part) | `Money` plus `MoneyString` contract | ~300 (155 / 145) | none | U2 |
| U4 | U2 (part) | Pure `redact()` plus spec wording alignment | ~250 (120 / 130) | none | U2 |
| U5 | U2 (part) | `RedactingLogger` | ~140 (70 / 70) | none | U4 |
| U6 | U3 (part) | `SecretBox` ports plus `AesGcmSecretBox` | ~250 (130 / 120) | none | U2 |
| U7 | U3 (part) | `FileKeyProvider` plus `SecretKeyBootstrap` | ~340 (150 / 190) | none | U6 |
| U8 | U4 (part) | Env schema and loopback rules | ~230 (100 / 130) | none | U2 |
| U9 | U4 (part) | Loader, paths, `ConfigModule`, `.env.example` | ~185 (115 / 70) | none | U8 |
| U10 | U6 (part) | Prisma schema and config, `PrismaService`, baseline migration | ~290 (150 / 140) | lockfile ~1,200, SQL ~15 | U9, U2 |
| U11 | U6 (part) | `PrismaKeyCheckStore` with the four key states | ~125 (35 / 90) | none | U7, U10 |
| U12 | U5 (part) | `allowed-origins`, `LocalRequestGuard`, error filter | ~350 (150 / 200) | none | U8, U1 |
| U13 | U5 (part) | `main.ts` ordered bootstrap, CORS, binding, HTTP guard tests | ~295 (155 / 140) | none | U5, U9, U11, U12 |
| U14 | U5 (part) | Health endpoint (GET /health route) controller and module | ~145 (45 / 100) | none | U13 |
| U15 | U7 (part) | Web scaffold: Vite, Tailwind, proxy, bundle check | ~175 (130 / 45) | lockfile ~2,500 | U1 |
| U16 | U7 (part) | Health UI, i18n, atoms/molecule | ~260 (160 / 100) | none | U14, U15 |
| U17 | new | Spanish README completion, spec alignment, final gate | ~100 | none | all |

No unit exceeds 400 hand-written lines on this estimate. Contingency splits, if apply measures over 400:
- U1: move `eslint.config.js` and the README stub into a follow-up "lint and docs" unit (about 110 lines).
- U7: split `SecretKeyBootstrap` and its test (about 150 lines) from `FileKeyProvider` (about 190).
- U12: split `allowed-origins.ts` with its test (about 90) from the guard (about 260).
- U16: split `i18n`/`http-client`/`useHealth` (about 125) from the container and presentational components (about 135).

Needs no size exception: none. Needs the most attention: U1, U7, U12.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| U1 | Workspace, tooling, test runner, contracts base | PR 1 | `pnpm --filter @importer/contracts test` | `pnpm install --frozen-lockfile && pnpm check && pnpm build` from the root | Whole unit; repo returns to empty |
| U2 | API package, ESM and DI and native spikes | PR 2 | `pnpm --filter @importer/api test` | `node` smoke inside `esm-boot.int.test.ts` (Nest app on ephemeral loopback port) | `apps/api/**` plus the build-approval lines in `pnpm-workspace.yaml` |
| U3 | `Money` | PR 3 | `pnpm --filter @importer/api exec vitest run src/shared-kernel/money` | N/A: pure value object, no runtime boundary | `shared-kernel/money/**`, `packages/contracts/src/money*` |
| U4 | `redact()` | PR 4 | `pnpm --filter @importer/api exec vitest run src/shared-kernel/logging/redact` | N/A: pure function | `shared-kernel/logging/redact*`; the spec wording edit is a separate hunk |
| U5 | `RedactingLogger` | PR 5 | `pnpm --filter @importer/api exec vitest run src/shared-kernel/logging` | Logger writes a seeded secret to an injected sink; assert absence | `shared-kernel/logging/redacting-logger*` |
| U6 | `SecretBox` | PR 6 | `pnpm --filter @importer/api exec vitest run src/shared-kernel/secrets` | N/A: crypto unit, no runtime boundary | `shared-kernel/secrets/**` excluding infrastructure key provider |
| U7 | Key file provider and key bootstrap | PR 7 | `pnpm --filter @importer/api exec vitest run src/shared-kernel/secrets` | Temp-dir key file: generated `0600`, loose mode rejected | `file-key-provider*`, `secret-key-bootstrap*`, `key-check-store.port.ts` |
| U8 | Env schema | PR 8 | `pnpm --filter @importer/api exec vitest run src/config` | N/A: pure schema | `config/env.schema*` |
| U9 | Loader, paths, `.env.example` | PR 9 | `pnpm --filter @importer/api exec vitest run src/config` | `loadConfig` against a temp `.env` file | `config/**` except schema, `.env.example` |
| U10 | Persistence core and migration | PR 10 | `pnpm --filter @importer/api exec vitest run src/persistence` | `pnpm db:migrate` twice on a temp `DATA_DIR`; WAL read back | `apps/api/prisma/**`, `prisma.config.ts`, `persistence/prisma.service*` |
| U11 | Key-check store | PR 11 | `pnpm --filter @importer/api exec vitest run src/persistence/prisma-key-check-store` | Four key-check states against a real temp database | `persistence/prisma-key-check-store*` |
| U12 | Local request guard | PR 12 | `pnpm --filter @importer/api exec vitest run src/local-security` | N/A: header matrix on the guard; HTTP runtime proof is in U13 | `local-security/**` |
| U13 | Ordered boot, CORS, binding | PR 13 | `pnpm --filter @importer/api exec vitest run src/main src/local-security` | Test app on an ephemeral loopback port with test-only `POST` controller | `main.ts`, `app.module.ts`, `local-security.module.ts` wiring |
| U14 | the /health route | PR 14 | `pnpm --filter @importer/api exec vitest run src/health` | `curl --fail http://127.0.0.1:<port>/health` against a booted API | `apps/api/src/health/**` |
| U15 | Web scaffold | PR 15 | `pnpm --filter @importer/web test` | `pnpm --filter @importer/web build`, then bundle scan | `apps/web/**` |
| U16 | Health UI | PR 16 | `pnpm --filter @importer/web test` | `pnpm dev`, open the shell, confirm badge states | `apps/web/src/**` health files |
| U17 | Docs and final gate | PR 17 | `pnpm check` | Follow the README on a clean checkout | `README.md`, spec wording edit |

Chain base boundaries (for `feature-branch-chain` if chosen): PR 1 base = tracker branch; each later PR base = the previous PR branch. For `stacked-to-main` each PR targets `main` after the previous one merges.

### Orchestrator checkpoints (not apply tasks)

- CP1, after U1 is merged: record `test_command: pnpm test` and `build_command: pnpm build` in `openspec/config.yaml` (`apply.test_command`, `verify.test_command`, `verify.build_command`, `testing.test_command`). Leave `coverage_command` empty (coverage provider not selected).
- CP2, after U2 is merged and the ESM spike result (task 2.5) is known: decide whether to set `strict_tdd: true`. Tasks from U3 onward are already ordered test-first (RED then GREEN), so they are valid either way.
- CP3, after U2: if the spike chose the CommonJS fallback, re-read U3 to U14 task paths and module settings before apply continues.
- CP4, after U17: update `testing.detected`, `projects`, and review `strict_tdd`.

Conventions for every unit: conventional commits, no AI attribution, English code and comments, neutral Spanish only in `README.md`. Never contact Shopify. Record the focused test result, runtime harness result and rollback boundary in the apply progress. Never trim comments or tests to fit the budget; report overage instead.

## Phase 1: U1 Workspace tooling, test runner, contracts base

Satisfies: workspace-tooling (layout, install, strict compilation, quality scripts), health-check (contract shape), runtime-configuration (`.gitignore` of real env).

- [x] 1.1 Verify scaffold item 12 and 7: resolve and pin exact versions of TypeScript, ESLint, `typescript-eslint`, Prettier, `eslint-config-prettier`, Vitest, zod. Verify pnpm 12 syntax for strict engine checks and whether `pre*` scripts run on `pnpm test`. Fallback for pre-scripts: call the contracts build explicitly in the root scripts.
- [x] 1.2 Create `package.json` (private, `engines.node >=24`, exact `packageManager`, scripts from D9), `pnpm-workspace.yaml`, `.node-version`.
- [x] 1.3 Create `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `NodeNext`).
- [x] 1.4 Create `.prettierrc.json`, `.prettierignore`; modify `.gitignore` to add `node_modules`, `dist`, `data/`, `.env`, `*.key`, `apps/api/src/generated/`.
- [x] 1.5 RED: create `packages/contracts/src/health.test.ts` and `api-error.test.ts` (valid and invalid bodies for `HealthResponse` and `ApiError`). Create `packages/contracts/package.json` (`@importer/contracts`, `exports` to `dist`), `tsconfig.json`, `vitest.config.ts` so the tests run and fail.
- [x] 1.6 GREEN: create `packages/contracts/src/health.ts`, `api-error.ts`, `index.ts` per the Interfaces section.
- [x] 1.7 RED then GREEN: create `packages/contracts/src/workspace-invariants.int.test.ts` asserting: web manifest, if present, has no `@importer/api` dependency and only `@importer/contracts` as workspace dependency; root `engines.node` is set. Vacuous for web until U15 by design.
- [x] 1.8 Create `eslint.config.js` (flat, type-aware, layer `no-restricted-imports` per D2, `process.env` ban outside `apps/api/src/config/` and `apps/web/vite.config.ts`, `no-floating-promises`).
- [x] 1.9 Create `README.md` stub in Spanish (title, state, link to the future quick start).
- [x] 1.10 Verify negative gates in a scratch copy outside the repo: type error fails `pnpm typecheck` naming the file; failing test fails `pnpm test`; `engines.node >=99` makes `pnpm install` report the mismatch; an import across a layer fails `pnpm lint`.
- [x] 1.11 Run `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm build`; confirm the lockfile is unchanged.

## Phase 2: U2 API skeleton and spikes

Satisfies: workspace-tooling (strict compilation, layout), persistence-baseline (native adapter prerequisite). Spikes first so a fallback is found before dependent work.

- [x] 2.1 Create `apps/api/package.json` (`@importer/api`, `"type": "module"`, Nest 12, `reflect-metadata`, `rxjs`, `vitest`), `tsconfig.json`, `tsconfig.build.json` (tests excluded), `vitest.config.ts`.
- [x] 2.2 Spike item 1 (ESM): RED `apps/api/src/esm-boot.int.test.ts` boots a Nest app from a tiny `apps/api/src/app.module.ts` under native ESM and answers on an ephemeral loopback port. Also run the Nest CLI watch mode once and record the result. Fallback if ESM fails: CommonJS API on Node 24 that loads the ESM contracts build through `require` (D1); record it and stop for CP3.
- [x] 2.3 Spike item 2 (DI): in the same test, inject a provider through an explicit `@Inject(TOKEN)` constructor parameter; confirm it resolves under the Vitest transform without decorator metadata. Fallback: add a metadata-emitting transform plugin to `vitest.config.ts`.
- [x] 2.4 Spike native driver (items 4 and 7): add `better-sqlite3` and `@prisma/adapter-better-sqlite3`; use the pnpm 12 build-script approval syntax in `pnpm-workspace.yaml`; RED then GREEN `apps/api/src/native-sqlite.int.test.ts` opens `:memory:`, runs `SELECT 1`. Fallback: stop and report; no alternate adapter is in scope (design Migration section).
- [x] 2.5 Record spike outcomes (ESM or CommonJS, DI transform, native build) in the apply progress for CP2 and CP3. Run `pnpm check`.

## Phase 3: U3 Money

Satisfies: money-value-object (all four requirements, nine scenarios).

- [x] 3.1 RED: create `apps/api/src/shared-kernel/money/money.test.ts` with tables of accepted and rejected inputs (`1,234`, `1.234,56`, `""`, `1.2.3`, `1e3`, `abc`, `NaN`, `+1`, `.5`, `5.`, whitespace, non-ASCII digits, a JS number), canonical forms (`007.50` is `7.5`, `12.00` is `12`, `-0.00` is `0`), `0.1 + 0.2 = 0.3`, `12345678901234567890.123456789` round trip, `1.50` equals `1.5`, `a` unchanged after `add`, `toFixed`, `compare`, `toJSON` returns a string.
- [x] 3.2 GREEN: create `apps/api/src/shared-kernel/money/money.ts` (bigint plus scale, `parse`, `tryParse`, `add`, `equals`, `compare`, `toFixed`, `isNegative`, `toString`, `toJSON`). Use a `MoneyError` with `code` of `AMBIGUOUS_SEPARATOR` for comma input and `INVALID_FORMAT` for everything else (the spec requires an ambiguity error distinct from a validation error).
- [x] 3.3 RED then GREEN: create `packages/contracts/src/money.ts` (`MoneyString` zod type on the canonical regex) and `money.test.ts`; export from `index.ts`.
- [x] 3.4 Add a cross-check test in `apps/api/src/shared-kernel/money/money-contract.int.test.ts`: every canonical output of `Money` parses under `MoneyString` and a JSON round trip stays a string.

## Phase 4: U4 redact() and spec alignment

Satisfies: local-security-baseline (redaction: seeded field, non-secret preserved). Resolves the `key` mismatch.

- [x] 4.1 Align spec wording: edit `openspec/changes/shopify-importer-01-foundation/specs/local-security-baseline/spec.md` so the redaction requirement lists key names as "token, secret, password, authorization, credential, signature, cookie, and secret-bearing key forms such as apiKey or secretKey" instead of bare "key". Confirm no scenario relies on a bare `key` name.
- [ ] 4.2 RED: create `apps/api/src/shared-kernel/logging/redact.test.ts`: key-name matrix at depth and case-insensitive (`accessToken` redacted; `product_key`, `keyId`, `count` preserved), `Bearer x`, `shpat_` style, URL query values and userinfo, `registerSecret` inside a longer string and the 8-character minimum, `Error` name/message/stack, cycle guard, depth cap, seeded secret absent from serialized output.
- [ ] 4.3 GREEN: create `apps/api/src/shared-kernel/logging/redact.ts` with the exported key-name constant and `registerSecret`.

## Phase 5: U5 RedactingLogger

Satisfies: local-security-baseline (message secret, field secret, non-secret preserved).

- [ ] 5.1 Verify scaffold item 8 (logger interface): confirm the NestJS `LoggerService` shape for Nest 12. Fallback: adapt the method set in the class; the test below fails first.
- [ ] 5.2 RED: create `apps/api/src/shared-kernel/logging/redacting-logger.test.ts` with an injected sink: one JSON line per event, `accessToken: "shpat_seed123"` absent, configured key `K` in a message absent after `registerSecret(K)`, `count: 3` kept, level filtering via `LOG_LEVEL`.
- [ ] 5.3 GREEN: create `apps/api/src/shared-kernel/logging/redacting-logger.ts` (sink as constructor argument; no NestJS import beyond the interface type).

## Phase 6: U6 SecretBox

Satisfies: secret-protection (round-trip, non-determinism, hides plaintext, tamper, wrong key, malformed, malformed key).

- [ ] 6.1 Create `apps/api/src/shared-kernel/secrets/secret-box.port.ts`, `key-provider.port.ts`, `key-check-store.port.ts` per Interfaces.
- [ ] 6.2 RED: create `apps/api/src/shared-kernel/secrets/aes-gcm-secret-box.test.ts`: round trip, two encryptions differ, ciphertext lacks plaintext, tamper each of IV/ciphertext/tag/keyId/context fails with `DECRYPT_FAILED`, wrong key fails, empty and malformed envelope give `MALFORMED_ENVELOPE`, no keyring gives `KEY_MISSING` naming `SECRET_KEY_FILE`, wrong key length error does not contain the key value.
- [ ] 6.3 GREEN: create `apps/api/src/shared-kernel/secrets/infrastructure/aes-gcm-secret-box.ts` (envelope `sb1.<keyId>.<iv>.<ct>.<tag>`, AAD `sb1|keyId|context`) and `SecretBoxError`.

## Phase 7: U7 Key file provider and bootstrap

Satisfies: secret-protection (missing key, malformed key, key file excluded), design D4 boot table.

- [ ] 7.1 RED: create `apps/api/src/shared-kernel/secrets/infrastructure/file-key-provider.int.test.ts` in a temp directory: generated with mode `0600` in a `0700` directory, exclusive create never overwrites, loose permissions rejected, malformed line, wrong length, duplicate id rejected with the file left untouched, permission check skipped with a warning on Windows.
- [ ] 7.2 GREEN: create `apps/api/src/shared-kernel/secrets/infrastructure/file-key-provider.ts` (never logs key material; errors name path and reason).
- [ ] 7.3 RED: create `apps/api/src/shared-kernel/secrets/secret-key-bootstrap.test.ts` with an in-memory `KeyCheckStore`: the five rows of the D4 table (generate and write; write only; decrypt ok; decrypt failure exits; key absent with row present exits and never regenerates).
- [ ] 7.4 GREEN: create `apps/api/src/shared-kernel/secrets/secret-key-bootstrap.ts` throwing a typed `BootError` the caller maps to exit 1.
- [ ] 7.5 Verify `git check-ignore` for a `secret.key` file inside the workspace (`*.key` rule from 1.4); record the output.

## Phase 8: U8 Env schema

Satisfies: runtime-configuration (validated startup, pinned API version, loopback defaults), local-security-baseline (non-loopback refusal and opt-in rule).

- [ ] 8.1 RED: create `apps/api/src/config/env.schema.test.ts`: defaults for all twelve D6 variables, `API_PORT=abc` names `API_PORT`, `SHOPIFY_API_VERSION=latest` names it, default `2026-10`, `API_HOST=0.0.0.0` without opt-in names `API_HOST`, same for `WEB_HOST`, opt-in only for the literal `true`, `ALLOWED_ORIGINS` rejects paths and `*`, derived default origins, all errors listed together and none contains a value.
- [ ] 8.2 GREEN: create `apps/api/src/config/env.schema.ts` (zod; single source for the API version; `process.env` never read here).

## Phase 9: U9 Loader, paths, `.env.example`

Satisfies: runtime-configuration (valid configuration, sample complete, real env ignored), persistence-baseline (configurable path default).

- [ ] 9.1 Verify scaffold item 6: Node 24 built-in env-file loader reads root `.env` and tolerates an absent file; note whether `prisma.config.ts` must call it (used in U10). Fallback: a small explicit file reader inside `load-config.ts`.
- [ ] 9.2 RED: create `apps/api/src/config/load-config.test.ts` and `paths.test.ts`: exit-path error lists variable names only, relative paths resolve against the workspace root, the home directory expands in `SECRET_KEY_FILE`, `.env.example` lists every schema variable, `git check-ignore .env` succeeds.
- [ ] 9.3 GREEN: create `apps/api/src/config/load-config.ts`, `paths.ts`, `config.module.ts`.
- [ ] 9.4 Create `.env.example` with every variable, empty or placeholder values, no secrets.

## Phase 10: U10 Persistence core and migration

Satisfies: persistence-baseline (local access, unwritable path, baseline, re-apply, readiness), secret-protection (empty secret storage).

- [ ] 10.1 Verify scaffold items 3, 4, 5 first. Add `prisma`, `@prisma/client`; create `apps/api/prisma/schema.prisma` (`prisma-client` generator, explicit `output`, `AppSetting`) and `apps/api/prisma.config.ts`; run `db:generate`; confirm the generated client compiles under the strict base flags (fallback: relax flags for `src/generated/` only), pragmas or busy timeout via adapter options or raw statements, a single connection, `prisma generate` and `migrate deploy` need no implicit generation.
- [ ] 10.2 Generate the baseline migration `apps/api/prisma/migrations/<timestamp>_baseline/migration.sql` and `migration_lock.toml` (generated; do not hand-edit); add `db:generate` and `db:migrate` root scripts.
- [ ] 10.3 RED: create `apps/api/src/persistence/prisma.service.int.test.ts`: apply the committed SQL to an empty temp file, apply again (no change, exit 0), read and write `app_setting`, `journal_mode` is `wal`, `busy_timeout` matches config, boot creates the database file when absent, unwritable `DATA_DIR` names `DATA_DIR`, missing `app_setting` aborts with the `db:migrate` instruction, `isReachable()` is true, false after the file is removed (no throw), a migrated database holds zero rows.
- [ ] 10.4 GREEN: create `apps/api/src/persistence/prisma.service.ts`, `persistence.module.ts`.

## Phase 11: U11 Key-check store

Satisfies: secret-protection (external key, no credential persisted), design D4.

- [ ] 11.1 RED: create `apps/api/src/persistence/prisma-key-check-store.int.test.ts` running `SecretKeyBootstrap` with the real store and a temp key file: the four states end to end; after bootstrap `app_setting` holds only the key-check row and its value is an envelope, never a plaintext credential.
- [ ] 11.2 GREEN: create `apps/api/src/persistence/prisma-key-check-store.ts` implementing `KeyCheckStore`; wire into `persistence.module.ts`.

## Phase 12: U12 Local request guard

Satisfies: local-security-baseline (origin guard: foreign, allowed, missing origin); design D7 rules 1 to 3.

- [ ] 12.1 Verify scaffold item 11 (documentation check, no browser): confirm `Origin` is sent on cross-origin non-safe requests, may be `null`, and `Sec-Fetch-Site` values and non-forgeability from page script. If the assumption fails, stop and report to the orchestrator; candidate fallback is a required custom header on non-safe requests, which is a design change.
- [ ] 12.2 RED: create `apps/api/src/local-security/allowed-origins.test.ts` and `local-request.guard.test.ts`: header matrix over method, `Host`, `Origin` (allowed, own, foreign, `null`, absent) and `Sec-Fetch-Site` (absent, `same-origin`, `none`, `same-site`, `cross-site`); `GET`, `HEAD`, `OPTIONS` never rejected by rules 2 and 3; rule 1 applies to every method; 403 bodies match `ApiError` with `HOST_NOT_ALLOWED` or `ORIGIN_NOT_ALLOWED`; rejection logged at `warn`.
- [ ] 12.3 GREEN: create `apps/api/src/local-security/allowed-origins.ts`, `local-request.guard.ts`, an exception filter producing the `ApiError` body, and `local-security.module.ts`.

## Phase 13: U13 Ordered boot, CORS, binding

Satisfies: local-security-baseline (loopback bind, restrictive CORS, origin guard over HTTP, key redaction), runtime-configuration (abort before listen).

- [ ] 13.1 Verify scaffold items 8 and 10: the global /api prefix with the /health route excluded, `listen(port, host)`, and that the Nest CORS options produce exactly the D7 policy (exact-match list, no credentials, no allow header for other origins, `Vary: Origin`). Fallback: a small hand-written CORS middleware inside `local-security`.
- [ ] 13.2 RED: create `apps/api/src/main.int.test.ts` on an ephemeral loopback port with a test-only `POST` controller registered in a test-built module (never in `AppModule`, excluded from `tsconfig.build.json`): foreign-origin POST is 403 and the handler does not run; allowed origin passes; no-origin POST passes; preflight allows only allow-listed origins; foreign-origin `GET` runs with no allow header; bound address is loopback; `0.0.0.0` with opt-in binds and logs one `non_loopback_bind` warn event; bad config, loose key file and key mismatch throw `BootError` before `listen`; the configured key value never appears in captured log output.
- [ ] 13.3 GREEN: create `apps/api/src/main.ts` (ordered `bootstrap()` per the boot diagram; `registerSecret` for the key; exit 1 on `BootError`), `apps/api/src/app.module.ts`, and CORS options in `local-security`.

## Phase 14: U14 Health endpoint

Satisfies: health-check (healthy, database down, no leakage, foreign origin read), persistence-baseline (readiness signal).

- [ ] 14.1 RED: create `apps/api/src/health/health.int.test.ts`: 200 body validates `HealthResponse` with `database: up`; database removed gives 503 with `degraded` and `down`; body contains neither the key value nor any path; foreign-origin GET /health returns the body and no allow header.
- [ ] 14.2 GREEN: create `apps/api/src/health/health.controller.ts` and `health.module.ts`; import in `app.module.ts`.
- [ ] 14.3 Run the runtime harness: boot the API against a temp `DATA_DIR`, then `curl --fail http://127.0.0.1:<port>/health`.

## Phase 15: U15 Web scaffold

Satisfies: workspace-tooling (web isolated from API, depends on contracts only), health-check (bundle free of server code, shell builds).

- [ ] 15.1 Verify scaffold item 9 and 12: pin React 19, Vite 8, Tailwind 4, the React Vite plugin and `@tailwindcss/vite`; confirm the Vite proxy leaves `Host` and `Origin` as the guard expects. Fallback: set `changeOrigin: false` and forward headers explicitly.
- [ ] 15.2 RED: create `apps/web/src/bundle.int.test.ts`: after `pnpm build`, `apps/web/dist` contains neither `@importer/api` nor a seeded secret; and an SSR render of `App` returns without throwing.
- [ ] 15.3 GREEN: create `apps/web/package.json` (depends on `@importer/contracts` only), `tsconfig.json`, `vite.config.ts` (proxy the /api prefix and the /health route, strict port, host from `WEB_HOST`), `index.html`, `src/main.tsx`, `src/styles.css`, `src/app/App.tsx` (placeholder shell). Note: Vite defaults mirror the API defaults and cannot import API config; keep them in one commented constant.

## Phase 16: U16 Health UI

Satisfies: health-check (shell renders, health obtained via contracts types), layering (container/presentational).

- [ ] 16.1 RED: create `apps/web/src/ui/molecules/HealthBadge.test.tsx` (server-side render for `loading`, `ok`, `degraded`, `unreachable`) and `apps/web/src/app/useHealth.test.ts` (parse with `HealthResponse`, invalid body maps to `unreachable`).
- [ ] 16.2 GREEN: create `apps/web/src/i18n/es.ts`, `src/api/http-client.ts`, `src/app/useHealth.ts`, `src/app/HealthStatusContainer.tsx`, `src/ui/atoms/StatusDot.tsx`, `src/ui/molecules/HealthBadge.tsx`; update `src/app/App.tsx`.
- [ ] 16.3 Re-run `pnpm build` and the bundle test from 15.2.

## Phase 17: U17 Documentation and final gate

Satisfies: workspace-tooling (README boot path, key loss documented), local-security-baseline (documented missing-origin decision).

- [ ] 17.1 Complete `README.md` in neutral Spanish: prerequisites (Node 24, pnpm, native SQLite build), install, `pnpm db:generate`, `pnpm db:migrate`, run, test, the /health route check, key file location and backup, and an explicit statement that losing the key makes encrypted secrets unrecoverable; document the no-`Origin` write behaviour.
- [ ] 17.2 Verify the README boot path on a clean checkout: frozen install, migrate, start, a failing-on-error curl request to the health route; record the exact output.
- [ ] 17.3 Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`; confirm all exit 0 and the lockfile is unchanged.
- [ ] 17.4 Confirm no task contacted Shopify and the success criteria in `proposal.md` are met.

## Traceability

| Requirement (spec) | Tasks |
|---|---|
| workspace-tooling: layout | 1.2, 1.7, 15.3 |
| workspace-tooling: reproducible install | 1.1, 1.2, 1.10, 1.11, 17.3 |
| workspace-tooling: strict compilation | 1.3, 1.10, 2.1 |
| workspace-tooling: root quality scripts | 1.2, 1.8, 1.10, 17.3 |
| workspace-tooling: Spanish documentation | 1.9, 17.1, 17.2 |
| runtime-configuration: validated startup | 8.1, 8.2, 9.2, 9.3, 13.2 |
| runtime-configuration: pinned API version | 8.1, 8.2 |
| runtime-configuration: loopback defaults | 8.1, 8.2 |
| runtime-configuration: secret-free sample | 1.4, 9.2, 9.4 |
| local-security: loopback binding | 8.1, 8.2, 13.2 |
| local-security: restrictive CORS | 13.1, 13.2, 13.3 |
| local-security: origin guard | 12.1 to 12.3, 13.2 |
| local-security: log redaction | 4.1 to 4.3, 5.1 to 5.3, 13.2 |
| secret-protection: round trip | 6.2, 6.3 |
| secret-protection: tamper and wrong key | 6.2, 6.3 |
| secret-protection: external key | 6.2, 7.1 to 7.5, 11.1 |
| secret-protection: no credential persisted | 10.3, 11.1 |
| money-value-object: all four requirements | 3.1 to 3.4 |
| persistence-baseline: local SQLite access | 2.4, 10.1, 10.3, 10.4 |
| persistence-baseline: baseline migration | 10.2, 10.3 |
| persistence-baseline: readiness signal | 10.3, 10.4, 14.1 |
| health-check: endpoint | 14.1 to 14.3 |
| health-check: read-only and origin-neutral | 14.1 |
| health-check: web shell boot | 15.2, 15.3, 16.1 to 16.3 |

Design "to verify" items: 1 (2.2), 2 (2.3), 3 (10.1), 4 (2.4, 10.1), 5 (10.1), 6 (9.1), 7 (1.1, 2.4), 8 (5.1, 13.1), 9 (15.1), 10 (13.1), 11 (12.1), 12 (1.1, 15.1; coverage provider deliberately not selected).

Scenarios not fully placed:
- Web shell "renders without runtime errors when loaded": only SSR and build are testable under the design (no DOM libraries until S6); a real browser load is a manual check in 17.2.
- "Unsupported Node version": verified manually in a scratch copy (1.10), not by a committed test.
- "Non-loopback with opt-in": with `API_HOST=0.0.0.0` the guard's own-host rule cannot match a `127.0.0.1` Host header; 13.2 sets `ALLOWED_ORIGINS` for that case (see risks).
