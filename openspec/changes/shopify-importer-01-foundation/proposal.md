# Proposal: Foundation for the Shopify Catalog Importer (S0)

S0 delivers a bootable, tested, empty workspace so slices S1 to S7 add features instead of plumbing. It makes no Shopify calls, parses no workbooks, and ships no feature screens.

## Intent

The repository has no code, no `package.json` and no test runner. Every later slice needs the same base: toolchain, security defaults, persistence and shared kernel. Building it once, first, keeps later reviews about behaviour.

## Inputs

| Kind | Item |
|---|---|
| Confirmed | D3: this change is S0 only (roadmap: `exploration.md` section 5) |
| Confirmed | D2: Admin GraphQL API version `2026-10`, one config value |
| Confirmed | D5: repository docs in neutral Spanish; code, comments, SDD artifacts in English; UI in Spanish |
| Confirmed | D8: `@prisma/adapter-better-sqlite3` wired explicitly (research C5.3b) |
| Proposed default | Node 24 LTS engine floor (C5.1, C5.6) |
| Proposed default | Prisma 7.10.x, not 8.0.0-rc (C5.4) |
| Proposed default | Other versions per C5.2, re-resolved at scaffold time |
| Proposed default | Vitest; zod for contracts; architecture option A (`exploration.md` section 4) |

Proposed defaults are not user decisions. Not covered by research, left to design: lint and format tools, zod version, decimal library [U].

## Scope

### In Scope
- pnpm workspace: `apps/api` (NestJS), `apps/web` (React, Vite, Tailwind), `packages/contracts`.
- Strict TypeScript, lint, format, Vitest; development, build and test scripts.
- Config module: pinned API version, loopback host and port; `.env.example` without secrets.
- Logger with secret redaction.
- `SecretBox`: encryption at rest, key held outside the database.
- `Money` value object: canonical decimal strings, no floating point.
- Prisma + SQLite through the adapter; baseline migration (contents set in design).
- `/health`; loopback binding, restrictive CORS, origin guard on write endpoints.
- Minimal Spanish README: install, run, test.

### Out of Scope
- S1 to S7 in full: workbook and validation, stores and Shopify gateway, images, plan, import engine, feature screens and reports, hardening and full documentation.
- Sharp, the XLSX library, Playwright, demo mode.
- Decisions D1, D4, D6, D7 and research items U1 to U8.

Boundary rule: S0 holds only what at least two later slices need and what is testable without Shopify.

## Capabilities

### New Capabilities
- `workspace-tooling`: workspace layout, strict compilation, lint, format, test runner, scripts.
- `runtime-configuration`: validated configuration, pinned API version, loopback host and port.
- `local-security-baseline`: loopback binding, CORS policy, origin guard, log redaction.
- `secret-protection`: `SecretBox` encrypt and decrypt contract, external key.
- `money-value-object`: decimal-safe amounts.
- `persistence-baseline`: SQLite access through the driver adapter, migrations.
- `health-check`: `/health` endpoint and web shell boot.

### Modified Capabilities
None. `openspec/specs/` is empty.

## Approach

Option A from the exploration. Screaming modules inside `apps/api`, with `shared-kernel` holding `Money`, the logger and `SecretBox`. `apps/web` depends only on `packages/contracts`, so secrets cannot reach the browser bundle. `SecretBox` follows exploration section 4 (AES-256-GCM, key in an environment variable or key file); no credential is persisted in S0.

Recommended delivery, not decided here: PR 0a repository and tooling, PR 0b skeletons and persistence. Under `ask-on-risk` the user is asked once the tasks forecast exists.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, root configs | New | Workspace and tooling |
| `apps/api/` | New | NestJS skeleton, config, kernel, guards, `/health` |
| `apps/api/prisma/` | New | Schema, baseline migration |
| `apps/web/` | New | Vite, React, Tailwind shell |
| `packages/contracts/` | New | Shared schemas |
| `.env.example`, `README.md` | New | Configuration sample, Spanish quick start |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Diff exceeds the 400-line budget; lockfile and migration SQL are generated and inflate it | High | Two-PR split; tasks forecast counts authored lines separately |
| npm versions moved since 2026-10-13 | Med | Re-resolve and pin exact versions when scaffolding |
| Node 24 enters Maintenance 2026-10-20 | Low | Revisit Node 26 after 2026-10-28 |
| `better-sqlite3` is native; local build may fail | Med | Document prerequisites; boot check in verification |
| Prisma 8 reaches general availability mid-change | Low | Stay on 7.10.x; upgrade is a separate change |
| Losing the `SecretBox` key makes secrets unrecoverable | Low in S0 | Document in README; no credentials stored yet |

## Verification Limits

- Nothing in S0 contacts Shopify and no real store exists. The pinned version is a stored value, not exercised.
- For later slices: variant barcodes use `barcodes: [{ value, type? }]`, never the deprecated `barcode` (C1.1 to C1.3). Not implemented or verified here.
- `strict_tdd` is false because no runner exists. S0 introduces one; the test command exists once the tooling work unit (PR 0a if split) lands. The orchestrator then records it in `openspec/config.yaml` and may revisit `strict_tdd`.

## Rollback Plan

S0 is additive on an empty repository. Revert the merge commits in reverse order (0b, then 0a). Delete the local SQLite file and the key file; no external system or stored credential is affected.

## Dependencies

- Node 24 and pnpm on the operator machine; npm registry access.

## Success Criteria

- [ ] Frozen-lockfile install succeeds on Node 24.
- [ ] Typecheck, lint, test and build scripts exit 0 from the root.
- [ ] The baseline migration applies to an empty SQLite file.
- [ ] The API listens on loopback only; `GET /health` returns 200.
- [ ] A write request with a foreign `Origin` is rejected (test).
- [ ] The logger redacts a seeded secret (test).
- [ ] `SecretBox` round-trips and rejects tampered ciphertext (test).
- [ ] `Money` preserves canonical decimal strings without float conversion (test).
- [ ] `apps/web` declares no dependency on `apps/api`.
- [ ] The app boots by following the README.
