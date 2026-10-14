# Proposal: Workbook and Validation Core (S1)

S1 lets an operator download the catalog template and get a local (tier A) validation report for a filled workbook. It is stateless and makes no Shopify calls.

## Intent

The importer cannot plan or import anything until a workbook is read safely and checked against the contract in the requirements document (sections 5 to 7). Untrusted XLSX files are ZIP archives; reading them needs bounded, library-independent defences first.

## Inputs

| Kind | Item |
|---|---|
| Confirmed | Product decisions 1a to 11a (`state.yaml`, preproposal revision 3) |
| Confirmed | D6: one barcode per variant; a multi-value cell blocks |
| Confirmed | D7: comma tags; S1 checks handle format and in-file uniqueness only |
| Confirmed | Library settled by the U3 spike: SheetJS CE 0.20.3 (vendored tarball, SHA-256), `modern-xlsx` 1.2.1, or an own thin OOXML reader |
| Evidence | `exploration.md`; `research.md` revision 2 (claims C1 to C22) |

## Scope

### In Scope
- Contracts: sheet and column constants, `ValidationReport`/`ValidationIssue` (codes, params, Spanish catalog, `fileSha256`, `truncated`), new `ApiError` codes.
- Own ZIP preflight before any library: caps, ratio, names, macros, external links, embeddings.
- `WorkbookReader` port and one adapter chosen by the spike.
- Tier A rules for structure, Productos, Variantes, Imagenes and cross-sheet references; pure image path syntax check (reused by S3).
- `GET /api/workbook/template` (two `EJEMPLO-` products, instructions sheet) and `POST /api/workbook/validate`.

### Out of Scope
- Tier B checks (existing handles, locations, currency scale), image file existence (S3), plan and import (S4, S5), screens (S6).
- Persistence, migrations, the Shopify `barcodes` shape (S5).

## Capabilities

### New Capabilities
- `workbook-contract`: sheets, columns, header matching (trimmed, case-folded, accent-insensitive).
- `workbook-file-safety`: ZIP preflight, caps, formula, macro and external-link rejection.
- `workbook-validation-rules`: tier A field, row and cross-sheet rules.
- `validation-report`: issue model, severities, codes, Spanish messages, truncation.
- `workbook-template`: template content and download.
- `workbook-validate-endpoint`: upload, limits, request errors versus report.

### Modified Capabilities
None. `money-value-object` is reused unchanged; the origin guard already covers the new POST.

## Approach

Approach A from the exploration: new screaming module `apps/api/src/catalog-workbook/` (domain, application, ports, infrastructure); decimals parsed via `Money`. Request problems return `ApiError` 4xx; content problems return 200 with a report. Fallback B (own reader) changes one adapter file.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `packages/contracts/src/` | New/Modified | Workbook schema, report, `ApiError` codes |
| `apps/api/src/catalog-workbook/` | New | Module, rules, adapters, controller |
| `apps/api/src/app.module.ts`, `eslint.config.js` | Modified | Wiring; `OTHER_MODULES` entry |
| `apps/web` test of `ApiError` codes | Modified | Closed enum extended |
| Vendored tarball + checksum | New | Only if the spike selects SheetJS |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| No candidate library passes the spike | Med | Own reader behind the port |
| Preflight and library parse ZIPs differently | Med | Preflight rejects ambiguous archives |
| Excel drops leading zeros | High | Text-formatted template columns; numeric-cell rules (11a) |
| U3 and U6 exceed 400 lines | High | Split; size exception asked under `ask-on-risk` |
| Undocumented Shopify limits | Med | Configurable soft limits as warnings |

## Verification Limits

S1 cannot verify real Excel behaviour (only generated fixtures) or any real Shopify store; nothing in S1 touches Shopify.

## Rollback Plan

Additive, no database change. Revert the chain merges in reverse order; remove the vendored tarball if present.

## Dependencies

- S0 archived; spike outcome before U4.

## Delivery and Review Forecast

Units U1 to U10 (~250 to 380 lines each), strict TDD, feature branch chain with `develop` as tracker. U3 and U6 are likely size exceptions. `400-line budget risk: High`; chained PRs recommended.

## Success Criteria

- [ ] Spike findings recorded; library chosen and pinned.
- [ ] Crafted bombs, macro, external-link and formula files are rejected before parsing (tests).
- [ ] Every tier A rule has a passing fixture test.
- [ ] Downloaded template validates with only `EJEMPLO-` warnings.
- [ ] Validate endpoint returns 4xx for request errors and 200 reports otherwise (integration tests).
- [ ] `pnpm test`, typecheck, lint and build exit 0.
