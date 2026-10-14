# Archive Report: shopify-importer-01-foundation

**Archived on**: 2026-10-14
**Artifact store**: openspec (repo-local planning home)
**Archived to**: `openspec/changes/archive/2026-10-14-shopify-importer-01-foundation/`
**Verdict at verification**: PASS WITH WARNINGS (0 critical, 0 blockers), per `verify-report.md` (evidence_revision `sha256:b7a5ed4b2e7b0701720249aef80bb3874940a74a81c6a532eb910c656c9196d9`)
**Tasks at close**: 65/65 complete, 0 unchecked (`tasks.md`, read at archive time)
**Scenarios at verification**: 59/59. After the archive-time amendments, the secret-protection "External key" requirement carries 5 scenarios instead of 3, so the archived specs hold 61 scenario headings. The two boot-time scenarios are evidenced by `secret-key-bootstrap.ts` and its test file, which exist in the repository; the compliance matrix was not re-run.
**Requirements**: 27/27 (per domain: health-check 3, local-security-baseline 4, money-value-object 4, persistence-baseline 3, runtime-configuration 4, secret-protection 4, workspace-tooling 5)

## Engram Observation IDs

None. The artifact store is openspec, so no Engram observations were read. The inputs were the files listed under "Sources Read".

## Sources Read

- `proposal.md`, `design.md`, `tasks.md`, `state.yaml`, `verify-report.md`
- `specs/{health-check,local-security-baseline,money-value-object,persistence-baseline,runtime-configuration,secret-protection,workspace-tooling}/spec.md`
- Native status: `gentle-ai sdd-status --cwd <repo> --json` before archive reported `dependencies.archive: ready` and `nextRecommended: archive`.

## Amendments Applied Before Archive

Requested by the orchestrator to resolve verify W1 and W2 and suggestions S1, S3 and S4. Requirement wording changed to match the shipped behaviour; no code, test, script or package file was touched.

- **a) `specs/secret-protection/spec.md`, "External key"**: the key comes from a key file only, located by `SECRET_KEY_FILE`; no environment variable carries key material. The missing-key text is split into three scenarios: construction without a key file fails with `KEY_MISSING` naming `SECRET_KEY_FILE`; boot with no key file and no key-check row generates a key and logs a one-time backup warning; boot with no key file and a stored key-check row aborts with `KEY_FILE_REQUIRED`.
- **b) `specs/runtime-configuration/spec.md`, "Secret-free environment sample"**: the sample is `env.example`, lists every variable with its real default (empty value is a configuration error), comments out only `ALLOWED_ORIGINS`, and holds no secret or machine-specific path.
- **c) `design.md`**: D7 states that a non-`true` `ALLOW_NON_LOOPBACK` value is a configuration error, not `false`; `.env.example` replaced by `env.example` at four occurrences; the `secrets/` folder replaced by `shared-kernel/secret-box/` in the file tree.
- **d) `proposal.md`**: `.env.example` replaced by `env.example` at two occurrences; success criteria 1 to 10 ticked.

The amendment note is appended to `verify-report.md` (section "Amendments at archive"). Its verdict and counts are unchanged.

## Specs Synced (openspec/specs)

All seven domains were new; `openspec/specs/` held only `.gitkeep`. Each delta was a full spec and was copied mechanically (no Read/Write of content).

| Domain | Action | Details |
|--------|--------|---------|
| health-check | Created | 3 ADDED requirements, 0 MODIFIED, 0 REMOVED, 0 RENAMED |
| local-security-baseline | Created | 4 ADDED |
| money-value-object | Created | 4 ADDED |
| persistence-baseline | Created | 3 ADDED |
| runtime-configuration | Created | 4 ADDED |
| secret-protection | Created | 4 ADDED |
| workspace-tooling | Created | 5 ADDED |

No destructive delta exists: there are no REMOVED or RENAMED requirements and no MODIFIED blocks.

Note: because no prior main spec existed, the delta files were copied verbatim. The main specs therefore keep the delta title line (`# Delta for ...`) and the `## ADDED Requirements` heading. This follows the skill's mechanical-copy rule. Normalising those headings would be a later edit to the main specs.

## Move and Readbacks

Step 2 (spec copy), readback `diff -r <delta spec> <openspec/specs/{domain}/spec.md>`: empty output for all seven domains (exit 0). A second readback over all seven after the move was also empty.

Step 3 (archive move), `git mv` of `openspec/changes/shopify-importer-01-foundation` to `openspec/changes/archive/2026-10-14-shopify-importer-01-foundation`. The pre-move recursive snapshot was compared with the archived folder: `diff -r` output empty, exit 0. The source directory no longer exists. `verify-report.md`, which was untracked, moved with the folder.

## Warnings and Open Items

1. **Verification evidence drift**: `verify-report.md` front matter carries `evidence_revision` and output hashes computed before the appended "Amendments at archive" section. The report bytes changed, so the hash no longer matches the file. The verdict and counts were not changed.
2. **Scenario count**: 59 at verification, 61 in the archived specs (see the header).
3. **`state.yaml` not updated**: it still says `verify: pending` and `archive: pending`. The skill does not require a state update, and `state.yaml` is orchestrator-owned.
4. **Design open questions not changed**: `design.md` lines 365 to 368 remain unchecked. Line 366 (default key location) and line 367 (health spec sentence) may already be answered by D4 and the shipped behaviour, and need a decision.
5. **Proposal Approach sentence not changed**: `proposal.md` line 60 still says the key is "in an environment variable or key file". The shipped key source is the key file only.
6. **Suggestions still open** (not part of this archive's scope): S2 (no automated test for the `*.key` ignore rule), S5 (no coverage provider or real-browser check), S6 (four tooling scenarios have no automated test).
7. **Branch name**: `verify-report.md` says "Branch: develop". The archive ran on `docs/foundation-archive-s0`.
8. **Git index**: `git mv` staged the renames. The files amended before the move show as `RM` (staged rename, unstaged content change). The new `openspec/specs/*` directories and the archived `verify-report.md` are untracked. The orchestrator should commit them together. No commit was made.

## Final State

The change is archived. Native status for the change no longer resolves (no active change under `openspec/changes/`). Verification found no CRITICAL issues. All 65 tasks are complete. The two WARNING items (W1, W2) are resolved at the spec level as described above. Suggestions S1, S3 and S4 are resolved in the documents. Suggestions S2, S5 and S6 remain open.
