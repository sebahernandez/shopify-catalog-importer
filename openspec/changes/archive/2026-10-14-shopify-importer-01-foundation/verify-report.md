```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:b7a5ed4b2e7b0701720249aef80bb3874940a74a81c6a532eb910c656c9196d9
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 27/27
scenarios: 59/59
test_command: fnm exec --using=24 corepack pnpm check
test_exit_code: 0
test_output_hash: sha256:073627cc62c472d3a3bd49f334eae834ea4790bc45c7bf95b2cfae489c79848d
build_command: fnm exec --using=24 corepack pnpm build
build_exit_code: 0
build_output_hash: sha256:ff043e99849c967e4bdca824cd5f886c24e7e427124f12c022f4bf609caaacbc
```

## Verification Report

**Change**: shopify-importer-01-foundation
**Version**: N/A (7 delta specs, 27 requirements, 59 scenarios)
**Mode**: Strict TDD (runner: `pnpm test`, Vitest 5.0.4)
**Branch**: develop (working tree clean after the verification runs)

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 65 |
| Tasks complete | 65 |
| Tasks incomplete | 0 |

tasks.md has 65 `[x]` and 0 `[ ]`. Counts agree with apply-progress (Batch 17: "65 of 65 overall") and with the code state: every unit U1-U17 has its source and test files on disk. Apply-progress batch 1 and 2 still say "of 61 overall" (historical wording; tasks grew to 65 later). Not a defect.

### Build and Tests Execution

Node 24.21.0, pnpm 12.11.2, all through `fnm exec --using=24 corepack pnpm ...`.

| Command | Exit | Result |
|---------|------|--------|
| `pnpm install --frozen-lockfile` | 0 | "Lockfile is up to date", 4 workspace projects, lockfile unchanged |
| `pnpm check` (typecheck, lint, format:check, test) | 0 | lint clean, "All matched files use Prettier code style!" |
| `pnpm build` | 0 | contracts, web (Vite), api (prisma generate + `nest build`) all Done |

Tests: 3,242 passed, 0 failed, 0 skipped (matches the expected total).

```text
packages/contracts test:  Test Files  4 passed (4)    Tests  44 passed (44)
apps/web test:            Test Files 13 passed (13)   Tests 193 passed (193)
apps/api test:            Test Files 33 passed (33)   Tests 3005 passed (3005)
```

The `skipIf` guards in `workspace-invariants.int.test.ts` evaluate to false (web package exists), so the web-isolation tests ran: contracts reports 44 passed of 44.

**Coverage**: not available (no coverage provider in any package.json). Skipped cleanly, not a failure.

Additional runs in a throwaway clone (temp dir, empty environment, temp HOME, loopback ephemeral ports): type error, failing test, unsupported engine, migrate and dev boot (see matrix). Leftover check after all runs: no `data/`, no `~/.shopify-catalog-importer`, `git status --short` empty. The app was never started.

### TDD Compliance

| Check | Result | Details |
|-------|--------|---------|
| TDD evidence reported | PASS | "TDD Cycle Evidence" tables in apply-progress batches 3-16 (Task, Test file, Layer, Safety net, RED, GREEN, Triangulate, Refactor). Column wording differs from the template (plain text instead of check marks) but carries the same content, including RED failure messages and GREEN counts. |
| Tasks have tests | PASS | U3-U16 each name test files; all exist on disk. U1/U2 (scaffold and spikes) and U17 (docs) legitimately have no cycle table; U1 has a workspace-invariants test, U2 has spike evidence and the esm/native-sqlite/DI integration tests. |
| RED confirmed | PASS | Every listed test file exists. |
| GREEN confirmed | PASS | Full suite re-run: 3,242/3,242 pass. |
| Triangulation | PASS | Tables, `it.each` sets and adversarial inputs per behaviour (e.g. Money 14 canonical / 23 malformed / 6 non-string; bootstrap D4 rows 1-6). |
| Mutation checks | Bonus | Batches 4-12 record mutation checks (break, see red, restore, green). |

**TDD Compliance**: 5/5 checks passed.

### Test Layer Distribution

Layers are indicated by file naming: `*.test.ts` unit, `*.int.test.ts` integration (real HTTP on loopback, real SQLite files in temp dirs, built bundle scan). Vitest only; no browser E2E tool is installed (the web tests assert server-rendered markup and built-bundle contents, not a real browser). 17 `*.int.test.ts` files plus unit files across contracts (4 files), web (13), api (33). SUGGESTION: no real-browser check of the page exists (the README states this honestly).

### Assertion Quality

Static scan of all test files for banned patterns: no `expect(true)` tautologies; no ghost loops found in the sampled suites (loops are over `it.each` tables with fixed non-empty data); the existing tests carry explicit "markers are real" and "helper is not vacuous" guards (health.int.test.ts lines 329 and 388) and apply-progress records a vacuous-pass fix in redacting-logger.test.ts. The scan was text-based, not a full manual read of 3,242 cases. **Assertion quality**: 0 CRITICAL, 0 WARNING found.

### Quality Metrics

**Linter**: no errors (ESLint 10 with type-aware rules, layer `no-restricted-imports`, `process.env` ban). **Type checker**: no errors (TypeScript 6.0.3, strict, all 3 packages). **Formatter**: clean.

### Spec Compliance Matrix

Evidence file paths are relative to `apps/api/src` (api), `apps/web/src` (web), `packages/contracts/src` (contracts). All referenced tests passed in this run.

#### health-check (3 requirements, 6 scenarios)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| Health endpoint | Healthy | api `health/health.int.test.ts` "answers 200 with the shared body"; contracts `health.test.ts` | COMPLIANT |
| Health endpoint | Database down | api `health/health.int.test.ts` "answers 503 ..." (disconnected, removed, replaced, check throws) | COMPLIANT |
| Health endpoint | No leakage | api `health/health.int.test.ts` "what the answer and the logs never contain" (key, paths, markers proven real) | COMPLIANT |
| Origin-neutral read | Foreign origin read | api `health/health.int.test.ts` "runs the handler for a foreign Origin and gives the page no allow header" | COMPLIANT |
| Web shell boot | Shell builds and renders | web `app/App.test.ts`, `index-html.test.ts`, `bundle.int.test.ts` "emits an HTML page ..."; `pnpm build` exit 0 | COMPLIANT |
| Web shell boot | Bundle free of server code | web `bundle.int.test.ts` "contains no server-side package name or path", "neither the seeded secret nor any environment access" | COMPLIANT |

#### local-security-baseline (4 requirements, 11 scenarios)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| Loopback-only binding | Default bind | api `main.int.test.ts` "listens on the configured loopback address and reports what is really bound"; `env.schema.test.ts` defaults | COMPLIANT |
| Loopback-only binding | Non-loopback without opt-in | api `main.int.test.ts` "refuses a non-loopback host without the opt-in before anything is created"; `local-security/bind-policy.test.ts` | COMPLIANT |
| Loopback-only binding | Non-loopback with opt-in | api `main.int.test.ts` "accepts a non-loopback bound address when the opt-in is set", "logs exactly one non_loopback_bind warning" | COMPLIANT |
| Restrictive CORS | Allowed origin preflight | api `main.int.test.ts` "answers a preflight from an allow-listed origin"; `local-security/cors-middleware.test.ts` | COMPLIANT |
| Restrictive CORS | Disallowed origin preflight | api `main.int.test.ts` "answers a preflight from any other origin with no allow header at all" | COMPLIANT |
| Origin guard | Foreign origin write | api `main.int.test.ts` "rejects a foreign-origin POST with 403 and never runs the handler"; `local-security/local-security.int.test.ts` | COMPLIANT |
| Origin guard | Allowed origin write | api `main.int.test.ts` "runs the handler for an allow-listed origin" | COMPLIANT |
| Origin guard | Missing origin write | api `main.int.test.ts` "runs the handler for a request with no Origin (a local client)"; `request-policy.test.ts` (design D7 decision recorded) | COMPLIANT |
| Secret redaction | Seeded secret in a field | api `shared-kernel/logging/redact.test.ts`, `redacting-logger.test.ts` (accessToken shpat_seed123) | COMPLIANT |
| Secret redaction | Seeded secret in a message | api `redacting-logger.test.ts`; `main.int.test.ts` "the key never appears in log output" | COMPLIANT |
| Secret redaction | Non-secret preserved | api `redact.test.ts` preserved-names set (count: 3) | COMPLIANT |

The test-only write route does not ship: api `local-security/no-test-route-ships.test.ts` (design requirement).

#### money-value-object (4 requirements, 9 scenarios)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| Canonical parsing | Preserves precision | api `shared-kernel/money/money.test.ts` (0.1 + 0.2 = 0.3) | COMPLIANT |
| Canonical parsing | Large and long values | api `money.test.ts` canonical table; contracts `money.test.ts` | COMPLIANT |
| Canonical parsing | Canonicalization | api `money.test.ts` ("007.50" canonical table) | COMPLIANT |
| Rejects ambiguous | Comma ambiguity | api `money.test.ts` comma set (AMBIGUOUS_SEPARATOR) | COMPLIANT |
| Rejects ambiguous | Malformed inputs | api `money.test.ts` 23 malformed cases | COMPLIANT |
| Rejects ambiguous | Non-string input | api `money.test.ts` 6 non-string cases | COMPLIANT |
| Immutable value semantics | Equality by value | api `money.test.ts` | COMPLIANT |
| Immutable value semantics | Operation leaves operands unchanged | api `money.test.ts` | COMPLIANT |
| Contract-safe serialization | JSON round trip | api `shared-kernel/money/money-contract.int.test.ts`; contracts `money.test.ts` | COMPLIANT |

#### persistence-baseline (3 requirements, 6 scenarios)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| Local SQLite access | Connect to configured file | api `persistence/prisma.service.int.test.ts`, `database-location.int.test.ts`, `main.int.test.ts` | COMPLIANT |
| Local SQLite access | Unwritable path | api `main.int.test.ts` "aborts with a PersistenceError naming DATA_DIR ..."; `database-location.int.test.ts` | COMPLIANT |
| Baseline migration | Apply to empty database | api `persistence/baseline-migration.int.test.ts` "applies the committed SQL to an empty database and records it" | COMPLIANT |
| Baseline migration | Re-apply | api `baseline-migration.int.test.ts` "changes nothing and exits 0 when applied again" | COMPLIANT |
| Readiness signal | Reachable | api `prisma.service.int.test.ts` | COMPLIANT |
| Readiness signal | Unreachable | api `prisma.service.int.test.ts` "reports false, without throwing, once the database file has been removed" | COMPLIANT |

#### runtime-configuration (4 requirements, 7 scenarios)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| Validated configuration | Valid configuration | api `config/env.schema.test.ts` explicit values; `config/config.module.test.ts`; `main.int.test.ts` | COMPLIANT |
| Validated configuration | Malformed port | api `env.schema.test.ts` "ports"; `load-config.test.ts` "lists every offending variable by name and never a value" | COMPLIANT |
| Pinned API version | Default version | api `env.schema.test.ts` "exposes the pinned API version as the single source constant" | COMPLIANT |
| Pinned API version | Malformed version | api `env.schema.test.ts` "SHOPIFY_API_VERSION" (`latest` rejected, named) | COMPLIANT |
| Loopback defaults | Defaults | api `env.schema.test.ts` "fills all twelve variables from an empty environment" | COMPLIANT |
| Secret-free sample | Sample is complete | api `config/env-example.test.ts` "lists every variable the schema reads" | COMPLIANT (scenario); requirement wording deviates, see Issues W2 |
| Secret-free sample | Real env ignored | api `env-example.test.ts` "ignores the real env file" (git check-ignore) | COMPLIANT |

#### secret-protection (4 requirements, 10 scenarios)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| Authenticated round-trip | Round trip | api `shared-kernel/secret-box/aes-gcm-secret-box.test.ts` | COMPLIANT |
| Authenticated round-trip | Non-deterministic output | `aes-gcm-secret-box.test.ts` "produces a different envelope on every call, with a different IV" | COMPLIANT |
| Authenticated round-trip | Ciphertext hides plaintext | `aes-gcm-secret-box.test.ts` "does not contain the plaintext in any readable form" | COMPLIANT |
| Tamper and wrong-key rejection | Tampered ciphertext | `aes-gcm-secret-box.test.ts` tamper series (opens untouched envelope first, then each change) | COMPLIANT |
| Tamper and wrong-key rejection | Wrong key | `aes-gcm-secret-box.test.ts` "rejects a different valid key with the same generic code" | COMPLIANT |
| Tamper and wrong-key rejection | Malformed input | `aes-gcm-secret-box.test.ts` malformed/oversize envelope cases | COMPLIANT |
| External key | Missing key | `aes-gcm-secret-box.test.ts` "fails with KEY_MISSING naming SECRET_KEY_FILE"; `secret-key-bootstrap.test.ts` row 5 (KEY_FILE_REQUIRED). Boot-time generation on first run differs, see Issues W1 | COMPLIANT (box level) |
| External key | Malformed key | `file-key-provider.int.test.ts`, `secret-key-bootstrap.test.ts` row 6; `main.int.test.ts` "the key never appears in log output" | COMPLIANT |
| External key | Key file excluded | `.gitignore` rule `*.key`; verified in this run with `git check-ignore -v secret.key` (matches `.gitignore:7`). No automated test, see Issues S2 | COMPLIANT (manual runtime check) |
| No credential persistence | Empty secret storage | api `baseline-migration.int.test.ts` "creates only app_setting, empty"; `prisma-key-check-store.int.test.ts` (only a key-check row, an encryption of a constant, no credential) | COMPLIANT |

#### workspace-tooling (5 requirements, 10 scenarios)

| Requirement | Scenario | Evidence | Result |
|---|---|---|---|
| Workspace layout | Web isolated from API | contracts `workspace-invariants.int.test.ts` "keeps the web package isolated from the API" (ran, not skipped) | COMPLIANT |
| Workspace layout | Web depends on contracts only | `workspace-invariants.int.test.ts` "depends on contracts only among workspace packages" | COMPLIANT |
| Reproducible install | Frozen install | Run in this verification: exit 0, lockfile unchanged, tree clean | COMPLIANT |
| Reproducible install | Unsupported Node version | `engines.node >=24` asserted by test; `engineStrict: true` in `pnpm-workspace.yaml`; re-proven in this run in a throwaway clone under a temp dir: `engines.node` set to `>=99` made `pnpm install --frozen-lockfile` exit 1 with ERR_PNPM_UNSUPPORTED_ENGINE (wanted >=99, current 24.21.0) | COMPLIANT |
| Strict compilation | Clean typecheck | `pnpm check` typecheck step exit 0 | COMPLIANT |
| Strict compilation | Type error detected | Re-proven in this run in a throwaway clone (temp dir): an added file with `const bad: number = "x"` made `pnpm typecheck` exit 1 and print `src/zz-bad.ts(1,14): error TS2322`; no automated test in the suite (manual proof also in task 1.10) | COMPLIANT |
| Root quality scripts | All gates pass | `pnpm check` and `pnpm build` exit 0 | COMPLIANT |
| Root quality scripts | Failing test fails the gate | Re-proven in this run in a throwaway clone (temp dir): an added test asserting `expect(1).toBe(2)` made `pnpm test` exit 1 (contracts: 1 failed, 4 passed); no automated test in the suite (manual proof also in task 1.10) | COMPLIANT |
| Spanish quick-start docs | README boot path | Re-proven in this run in a throwaway clone under a temp dir (empty environment, temp HOME, ephemeral loopback ports 38211/38212, key file inside the temp dir): `pnpm db:migrate` exit 0 (all migrations applied); `pnpm dev` came up; `GET /health` on the API returned `HTTP/1.1 200 OK` with `{"status":"ok","database":"up","shopifyApiVersion":"2026-10"}`; Vite root returned 200 text/html and proxied `/health` with the same body; data dir mode 700, `importer.db` 600, key dir 700, key file 600, one `key_file_generated` warning; processes stopped, no listener left, temp dir removed. Also recorded in apply-progress 17.2 | COMPLIANT |
| Spanish quick-start docs | Key loss documented | README section "Clave de cifrado": "si pierde la clave, los secretos cifrados son irrecuperables" (read in this run) | COMPLIANT (document inspection) |

**Compliance summary**: 59/59 scenarios compliant (55 by passing suite tests or direct runtime checks, plus 4 tooling scenarios proven by execution in this run in throwaway temp-dir clones, without an automated test in the suite: see S6), 0 FAILING, 0 UNTESTED, 0 PARTIAL. Requirements complete: 27/27.

### Correctness (Static Evidence)

| Requirement area | Status | Notes |
|---|---|---|
| Workspace layout, engines, strict TS | Implemented | 3 packages; web depends only on `@importer/contracts`; `engines.node >=24`; `engineStrict: true`. |
| Root scripts | Implemented | typecheck, lint, format:check, test, build, dev, plus db:generate/db:migrate and `pre*` contracts builds. |
| Config schema (12 variables) | Implemented | Single pinned version constant `2026-10`; errors name variables, never values. |
| Local security | Implemented | Host/Origin guard, CORS allow-list with no wildcard, bind policy checked before and after listen. |
| Redaction | Implemented | `redact()` plus `RedactingLogger`; the configured key value is redacted. |
| SecretBox | Implemented | AES-GCM envelope `sb1.<keyId>.<iv>.<ct>.<tag>`, AAD binds key id and context. |
| Key handling | Implemented with deviation | See W1. |
| Money | Implemented | String-only canonical decimal in both api kernel and contracts. |
| Persistence | Implemented | Prisma 7.10 + better-sqlite3 adapter; one baseline migration; `app_setting` table. |
| Health + web shell | Implemented | `GET /health` returns 200/503 with the shared contract body; React shell consumes it via the contracts types. |
| README | Matches reality | Checked: variables table equals `env.example` and the schema defaults; `.gitignore` entries listed in README match the file; the `pnpm-workspace.yaml` allowBuilds claim matches; exit codes 1 and 70 match `process-exit.ts`; Sec-Fetch-Site missing-Origin rule matches `request-policy.ts`; `.node-version` is 24; package manager 12.11.2; commands table matches root scripts. README is Spanish; code and comments are English. |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 workspace layout, ESM | Yes | ESM spike passed (`esm-boot.int.test.ts`). |
| D2 lint/format, layer rules | Yes | Layer rules and `process.env` ban enforced by ESLint; kernel imports nothing from NestJS (deviation: kernel-owned `LoggerPort`, recorded and compile-checked against `LoggerService`). |
| D3 first migration | Yes | Only `app_setting`, columns as in design (asserted by test). |
| D4 SecretBox / key bootstrap | Yes, with a recorded path change | Folder is `shared-kernel/secret-box/` instead of `secrets/` (user deny rule). Bootstrap table rows 1-6 each tested. |
| D5 Money | Yes | |
| D6 configuration | Yes | Sample file is `env.example` (no dot), see W2/S3. |
| D7 local security | Mostly | Non-`true` opt-in value is an error, not `false` (S1). Missing-Origin rule documented and tested. |
| D8 logger redaction | Yes | |
| D9 test strategy | Yes | Vitest, unit plus loopback integration, exact pins. |
| D10 delivery split | Followed (recommendation) | Delivered as many small PRs with user-accepted size exceptions, tracked in state.yaml. |

### Proposal success criteria (10)

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Frozen install on Node 24 | Met | Run here, exit 0 |
| 2 | Typecheck, lint, test, build exit 0 | Met | Run here, exit 0 (format:check too) |
| 3 | Baseline migration on empty SQLite | Met | `baseline-migration.int.test.ts` passed |
| 4 | Loopback only; health 200 | Met | `main.int.test.ts`, `health.int.test.ts` passed |
| 5 | Foreign Origin write rejected | Met | `main.int.test.ts`, `local-security.int.test.ts` passed |
| 6 | Logger redacts seeded secret | Met | `redact.test.ts`, `redacting-logger.test.ts` passed |
| 7 | SecretBox round trip, rejects tampering | Met | `aes-gcm-secret-box.test.ts` passed |
| 8 | Money canonical, no float | Met | `money.test.ts`, contracts and contract-integration tests passed |
| 9 | Web declares no API dependency | Met | `apps/web/package.json` plus invariant tests (ran, 0 skipped) |
| 10 | App boots by following the README | Met | Re-proven here in a temp-dir clone (migrate, dev, `/health` 200 on API and via Vite, page 200); no real-browser check |

Proposal checkboxes (proposal.md lines 102-111) remain unticked (S4).

### Issues Found

**CRITICAL**: None.

**WARNING** (2):

- W1. secret-protection "External key" deviates from the spec text (about lines 51 and 55 of the spec). The spec allows the key from an environment variable or a key file and says a missing key MUST fail startup of any component needing `SecretBox`. Implemented: key file only (`SECRET_KEY_FILE`); no environment variable carries the key. At boot, an absent file with no stored key-check row generates a key (design D4, with a one-time backup warning); an absent file with a stored check aborts with `KEY_FILE_REQUIRED`. Reasoning for WARNING and not CRITICAL: the requirement says "environment variable or key file", so a file-only source is inside the allowed set; the missing-key scenario ("SecretBox is constructed with no key variable and no key file -> fails naming the missing source") is met at box level (`KEY_MISSING` naming `SECRET_KEY_FILE`); the first-run generation is a deliberate, design-approved, tested decision and is safer for a local single-user tool than refusing to start. But the spec text, taken literally, says "MUST fail startup" and no longer matches the shipped behaviour, so the spec delta (or a documented decision in the archive) must be updated before archive.
- W2. runtime-configuration "Secret-free environment sample" (about line 49 of the spec) says each variable has a placeholder or empty value. Implemented: `env.example` carries the real defaults (an empty value is a configuration error per the schema), and only `ALLOWED_ORIGINS` is commented out. Both scenarios (complete, real env ignored) pass and the sample holds no secret and no machine path (tested). WARNING because the requirement wording is contradicted although the intent (secret-free, complete, usable) is better served; fix by amending the spec wording at archive.

**SUGGESTION** (6):

- S1. Design D7 says a non-`true` opt-in value means false; the implementation rejects it as an error (`ALLOW_NON_LOOPBACK` must be exactly `true` or `false`, documented in README and tested). Safer direction (a typo cannot silently fail open or closed unnoticed). Update design.md D7 to match; no code change.
- S2. The "Key file excluded" scenario (`*.key` ignored) has no automated test, unlike `.env` which is covered in `env-example.test.ts`. Add a `git check-ignore` assertion for a `*.key` name. Verified manually in this run.
- S3. Stale names in planning artifacts: design.md (about lines 116, 195, 279, 328) and proposal.md (about lines 29 and 73) say `.env.example`; design.md (about line 208) says a `secrets/` folder. Actual: `env.example` and `shared-kernel/secret-box/`. Cause: the user's global deny rules block `.env*` and `secrets/*` paths; the rename decisions are recorded in state.yaml and apply-progress. Annotate or correct at archive so the archived design matches the code.
- S4. proposal.md success-criteria checkboxes are unticked although all ten are met (criterion 10 on recorded evidence). Tick them during archive.
- S5. No coverage tool and no real-browser check exist; the README states the browser limit. Consider adding a coverage provider in a later slice. Also, the README documents Vite not reading `.env` as a known limitation (a real usability gap, not a spec violation).
- S6. Four workspace-tooling scenarios (Unsupported Node version, Type error detected, Failing test fails the gate, README boot path) have no automated test in the suite; they were proven manually in task 1.10 and 17.2 and re-proven by execution in this verification in throwaway temp-dir clones (never in the real repo, never with the real HOME). Consider a scripted negative-gate check in a later slice.

### Verdict

PASS WITH WARNINGS

All 65 tasks complete; install, check (3,242 tests) and build all exit 0; 59/59 scenarios and 27/27 requirements proven by passing tests or direct runtime checks (4 tooling scenarios by execution in temp-dir clones); no CRITICAL findings. The two warnings are spec-text drift to resolve (amend the secret-protection and runtime-configuration deltas, or record the decisions) when archiving.

## Amendments at archive

Applied on 2026-10-14 by `sdd-archive`, before the change was archived, to resolve W1 and W2 and the S1, S3 and S4 items above. The verdict, the counts and the findings in this report are unchanged.

- a) `specs/secret-protection/spec.md`, requirement "External key": the key source is a key file only, located by `SECRET_KEY_FILE`; no environment variable carries key material (W1). The missing-key text is split into three scenarios: construction without a key file fails with `KEY_MISSING` naming `SECRET_KEY_FILE`; boot with no key file and no key-check row generates a key and logs a one-time backup warning (design D4); boot with no key file and a stored key-check row aborts with `KEY_FILE_REQUIRED`.
- b) `specs/runtime-configuration/spec.md`, requirement "Secret-free environment sample": the sample is named `env.example`, lists every variable with its real default (an empty value is a configuration error), comments out only `ALLOWED_ORIGINS`, and holds no secret or machine-specific path (W2).
- c) `design.md`: D7 states that a non-`true` `ALLOW_NON_LOOPBACK` value is a configuration error, not `false` (S1). `.env.example` is replaced by `env.example` at its four occurrences (S3). The `secrets/` source folder is replaced by `shared-kernel/secret-box/` in the file tree (S3).
- d) `proposal.md`: `.env.example` is replaced by `env.example` at its two occurrences (S3). Success criteria 1 to 10 are ticked, as this report records them as met (S4).

Not amended (outside the requested scope, left for a later decision): the open-question checkboxes in `design.md` (lines 365 to 368), and the proposal "Approach" sentence that describes the key as "in an environment variable or key file" (the shipped key source is the key file only).
