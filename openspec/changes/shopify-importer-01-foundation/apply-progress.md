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
