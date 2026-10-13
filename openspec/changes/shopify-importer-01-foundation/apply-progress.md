# Apply Progress: shopify-importer-01-foundation

Mode: Standard (strict_tdd false; U1 followed RED then GREEN where tasks.md orders it).

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
