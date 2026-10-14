# Tasks: Workbook and Validation Core (S1)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~4,100 hand-written (range 3,500 to 4,800; ~50% tests). Generated: lockfile only, plus the vendored SheetJS tarball if it wins (binary, not counted). Deletions negligible. |
| 400-line budget risk | High for the change as a whole; every unit is planned within 400 and none needs a size exception. Watch U2 and U8 (~380, near the budget) and U3c (the spike outcome can add vendoring and measurement work) |
| Chained PRs recommended | Yes |
| Suggested split | 16 chained work units: U1a, U1b, U2a, U2b, U2c, U3a, U3a2, U3b1, U3b2, U3c, U4, U5, U6a, U6b, U7, U8, U9, U10, plus a final gate that rides on the U10 PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain (tracker branch: develop) |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

No remaining decision. Resolved decisions:
- U3b is split into U3b1 (ZIP archive checks, design preflight steps 1 to 6, tasks 4.1 to 4.6 and 4.10) and U3b2 (content checks, step 7, tasks 4.7 to 4.9 and 4.11), confirmed by the maintainer on 2026-10-14. No size exception is needed for U3b.
- U6 is already split into U6a (~220) and U6b (~230); the split is kept.
- Any unit that measures over 400 hand-written lines at apply time is reported, never trimmed (no comment or test removal to fit). Near budget and watched: U2 and U8 (~380), and U3c (spike outcome).

Estimates keep the design's figures (about 30 percent uncertainty). They were not shrunk to fit.

### Chain bases (feature-branch-chain, tracker = develop)

PR for U1a targets develop. Every later PR targets the branch of the previous unit in the order U1a, U1b, U2a, U2b, U2c, U3a, U3a2, U3b1, U3b2, U3c, U4, U5, U6a, U6b, U7, U8, U9, U10. If a child PR shows the previous unit's changes, its base is wrong and must be retargeted. Only the tracker merges onward.

### Size and scope per work unit

| Unit | Branch | Scope | Depends on | Hand-written lines | Spec requirements covered (capability: requirement) |
|---|---|---|---|---|---|
| U1a | `feat/workbook-u1a-schema-catalog` | Schema constants and issue catalog (split from U1 by user decision on 2026-10-14: U1 measured about 482 lines) | none (S0 archived) | ~340 |
| U1b | `feat/workbook-u1b-report-api-errors` | Report model and ApiError codes | U1a | ~150 | workbook-contract: Sheet and column constants; validation-report: Issue model, Spanish catalog, Severities and counts (shape); endpoint: Request errors (codes) |
| U2 | `feat/workbook-u2-domain-core` | Limits, cell model, matchKey, field parsers, image path, collector, lint D2 | U1b | ~380 | workbook-contract: name matching (matchKey), Cell value model, One barcode and comma tags (tags); file-safety: Configurable caps (defaults); rules: Image path syntax check, Tag checks (parser), Decimal/Inventory parsers; report: Truncation (collector) |
| U3a | `feat/workbook-u3a-ooxml-writer` | Own ZIP and OOXML writer, test-support exclusion (tasks 3.1 to 3.5, 3.8, 3.9; the fixture builder was cut to U3a2 because the writer alone measured 315 lines) | U2 | ~315 | workbook-template: Identifier columns keep text, Usability aids (writer primitives) |
| U3a2 | `feat/workbook-u3a2-fixture-builder` | Fixture builder and crafted ZIPs (tasks 3.6, 3.7, 3.10) | U3a | ~400 (may need a further split if the crafted cases do not fit) | Provides crafted-file fixtures for file-safety scenarios used by U3b1, U3b2, U3c, U4 |
| U3b1 | `feat/workbook-u3b1-zip-archive-checks` | ArchiveInspector port, ZIP archive checks (preflight steps 1 to 6: magic bytes, EOCD, entry count, central-directory walk, local-header overlap, bounded inflation with size, CRC and ratio) | U3a2 | ~230 | file-safety: Preflight before parsing (archive part), Configurable archive caps, Ambiguous and unsafe archives |
| U3b2 | `feat/workbook-u3b2-zip-content-checks` | Content checks (step 7: required parts, macros, external links, embedded objects, library-independent formula scan), the ArchiveInspector implementation | U3b1 | ~200 | file-safety: Preflight before parsing (content part, inspector-level spy), Macros/links/embedded, Formulas (package scan) |
| U3c | `feat/workbook-u3c-library-spike` | Spike probes, findings, vendoring or pin | U3b2 | ~200 | none directly; settles the library for U4 (design D4) |
| U4 | `feat/workbook-u4-reader-adapter` | WorkbookReader port, chosen adapter, contract suite, formula guard | U3c | ~320 | contract: Cell value model; file-safety: Formulas (reader), Sheet size caps; report: no-leak (reader failure) |
| U5 | `feat/workbook-u5-structure-productos` | Structure resolution, row reading, cell-kind issues, Productos rules | U2, U4 | ~330 | contract: matching, Header row, Optional instructions; rules: Structure, Productos fields, Example products, Tags, Other cell kinds; file-safety: Formulas (per cell), Sheet size caps (per cell) |
| U6a | `feat/workbook-u6a-variantes-identity` | Variantes identity, SKU policy, numeric SKU cells | U5 | ~220 | rules: SKU policy, Barcode and numeric identifier (sku part) |
| U6b | `feat/workbook-u6b-variantes-options` | Options, combinations, simple product, soft limits | U6a | ~230 | rules: Variant structure and options |
| U7 | `feat/workbook-u7-variantes-values` | Price, compare-at, barcode, inventory, stock, location | U6b | ~300 | rules: Decimal prices through Money, Barcode (barcode part), Inventory and location |
| U8 | `feat/workbook-u8-images-assembly-usecase` | Imagenes rules, cross-sheet rules, assembly, CatalogDraft, use case | U7 | ~380 | rules: Image rules, Cross-sheet references, Determinism; report: Severities, Fingerprint, Truncation, Rejected shape, No leak; file-safety: Preflight before parsing (reader not called), No network and no writes; endpoint: Unexpected failures (use case) |
| U9 | `feat/workbook-u9-template-module` | Template content, template writer, module, GET route | U8 | ~350 | template: all six requirements; endpoint: Template round trip (use case level) |
| U10 | `feat/workbook-u10-validate-endpoint` | POST route, bounded body, error mapping, HTTP and perf tests, final gate | U9 | ~350 | endpoint: all seven requirements; report: Fingerprint (HTTP) |

Tasks 1.1 to 14.7 below are grouped by phase; each phase equals one unit, except Phase 4, which holds two units (U3b1 and U3b2), and Phase 14, which rides on U10. Total: 123 tasks, every one a checkbox line.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| U1 | Contracts for workbook, report, catalog, ApiError | PR 1 | `pnpm --filter @importer/contracts test` | N/A: pure schemas; web compile check via `pnpm --filter @importer/web test` | `packages/contracts/src/{workbook-schema,validation-report,issue-catalog}*`, `api-error*`, `index.ts` |
| U2 | Pure domain core and lint rule | PR 2 | `pnpm --filter @importer/api exec vitest run src/catalog-workbook/domain` | N/A: pure functions; lint negative gate in 2.2 | `catalog-workbook/domain/**`, the eslint block |
| U3a | Writer and fixture builder | PR 3 | `pnpm --filter @importer/api exec vitest run src/catalog-workbook/infrastructure/ooxml src/catalog-workbook/test-support` | `pnpm build` then confirm dist has no test-support | `infrastructure/ooxml/**`, `test-support/**`, `tsconfig.build.json` line |
| U3b1 | ZIP archive checks | PR 4 | `pnpm --filter @importer/api exec vitest run src/catalog-workbook/infrastructure/zip/zip-preflight.int.test.ts` | Crafted-archive matrix against the real preflight (the int tests) | `infrastructure/zip/{central-directory,bounded-inflate,archive-preflight}*`, `ports/archive-inspector.port.ts` |
| U3b2 | ZIP content checks | PR 5 | `pnpm --filter @importer/api exec vitest run src/catalog-workbook/infrastructure/zip` | Crafted-package matrix against the real inspector (the int tests) | `infrastructure/zip/{content-scan,zip-archive-inspector}*` |
| U3c | Library spike and pin | PR 6 | `pnpm --filter @importer/api exec vitest run src/catalog-workbook/infrastructure/spike` | Probes on U3a fixtures, measured in the findings | `vendor/sheetjs/**` or the pinned dependency, probe, findings file |
| U4 | Reader adapter | PR 7 | `pnpm --filter @importer/api exec vitest run src/catalog-workbook/infrastructure/reader` | Shared reader contract suite on builder fixtures | `infrastructure/reader/**`, `ports/workbook-reader.port.ts` |
| U5 | Structure and Productos | PR 8 | `pnpm --filter @importer/api exec vitest run src/catalog-workbook/domain/structure src/catalog-workbook/domain/rules` | N/A: in-memory cell model, no XLSX | `domain/structure/**`, `domain/rules/productos*` |
| U6a | Variantes identity and SKU | PR 9 | `pnpm --filter @importer/api exec vitest run src/catalog-workbook/domain/rules` | N/A: pure rules | `domain/rules/variantes-identity*` |
| U6b | Options and combinations | PR 10 | `pnpm --filter @importer/api exec vitest run src/catalog-workbook/domain/rules` | N/A: pure rules | `domain/rules/variantes-options*` |
| U7 | Variantes values | PR 11 | `pnpm --filter @importer/api exec vitest run src/catalog-workbook/domain/rules` | N/A: pure rules | `domain/rules/variantes-{price,barcode,inventory}*` |
| U8 | Images, assembly, use case | PR 12 | `pnpm --filter @importer/api exec vitest run src/catalog-workbook/domain src/catalog-workbook/application` | Use case with the real inspector and reader on a builder workbook | `domain/rules/imagenes*`, `domain/catalog-draft*`, `application/**` |
| U9 | Template and GET | PR 13 | `pnpm --filter @importer/api exec vitest run src/catalog-workbook` | Boot API, download the template with curl into the scratch directory | `infrastructure/http/**` (GET), template files, module wiring in `app.module.ts` |
| U10 | POST validate and gate | PR 14 | `pnpm --filter @importer/api exec vitest run src/catalog-workbook/infrastructure/http` | Boot API, POST the downloaded template with curl, read the report | POST route, `bounded-body-reader*` |

Orchestrator checkpoints (not apply tasks):
- CP1, after U3c merges and before U4 starts: confirm the library choice in `spike-findings.md`; if fallback B was chosen, re-read U4 scope and expect U4 above 320 lines.
- CP2, after U3b1 and U3b2 are each measured: confirm both are within 400 hand-written lines (no exception is expected); U3c does not start before U3b2 merges.
- CP3, after U10: update `state.yaml` phases and run sdd-verify.

Conventions for every unit: conventional commits, no AI attribution, English code and comments, Spanish only inside the contracts catalog and the template content. Never contact Shopify. The spec files are authoritative for exact codes and field names; the design was aligned to the specs, and if any wording still differs (see 1.1) follow the spec. Record the focused test result, the runtime harness result and the measured hand-written line count in the apply progress.

## Phase 1: U1 Contracts (delivered as U1a: 1.1 to 1.3, 1.6, 1.7 and U1b: 1.4, 1.5, 1.8 to 1.11)

Satisfies: workbook-contract (Sheet and column constants), validation-report (Issue model, Spanish catalog, Severities and counts), workbook-validate-endpoint (error codes).

- [x] 1.1 Confirm names before coding: record in the apply progress that design.md was aligned to the specs (issue `field`, `suggestedAction`, `summary.errorCount` and `warningCount`, params may be string, number or boolean, codes `FILE_NOT_XLSX`, `FILE_UNREADABLE`, `ZIP_*`, `MACROS_NOT_ALLOWED`, `CELL_TEXT_TOO_LONG`, `SHEET_ROW_LIMIT_EXCEEDED`), that the specs win if any wording still differs, and that the design and U1 add a third ApiError code `WORKBOOK_UNSUPPORTED_MEDIA_TYPE` (415) that the endpoint spec does not list. No file edit.
- [x] 1.2 RED: create `packages/contracts/src/workbook-schema.test.ts`: three data sheets plus `Instrucciones`, every column in spec order, required flags (product_key, handle, titulo; product_key, precio; product_key, archivo, orden), `EXAMPLE_PREFIX`, and the source has no `node:` import.
- [x] 1.3 GREEN: create `packages/contracts/src/workbook-schema.ts` (`SHEETS`, `COLUMNS` with required flags, `EXAMPLE_PREFIX`).
- [x] 1.4 RED: create `packages/contracts/src/validation-report.test.ts`: cell-level issue (error, Variantes, row 4, field precio, product key, non-empty texts), file-level issue with null sheet/row/field, unknown code fails, flat params of string, number or boolean, `fileSha256` is 64 lowercase hex, `valid` true if and only if `errorCount` is 0, `truncated` boolean.
- [x] 1.5 GREEN: create `packages/contracts/src/validation-report.ts` (`ValidationIssue`, `ValidationReport` zod schemas).
- [x] 1.6 RED: create `packages/contracts/src/issue-catalog.test.ts`: every code has a non-empty message and action, `DECIMAL_SCALE_EXCEEDED` with limit 4 and actual 5 shows both numbers, no `{` left after rendering with declared params, same input gives same text, every code declares its param keys.
- [x] 1.7 GREEN: create `packages/contracts/src/issue-catalog.ts` with `ISSUE_CODES` (file-level and structure codes only: FILE_NOT_XLSX, FILE_ENCRYPTED_OR_LEGACY, FILE_UNREADABLE, ZIP_*, MACROS_NOT_ALLOWED, EXTERNAL_LINKS_NOT_ALLOWED, EMBEDDED_CONTENT_NOT_ALLOWED, FORMULA_NOT_ALLOWED, SHEET_*_LIMIT_EXCEEDED, CELL_TEXT_TOO_LONG, SHEET_MISSING, SHEET_DUPLICATE, HEADER_MISSING, HEADER_DUPLICATE, the warnings `HEADER_UNKNOWN` and `HIDDEN_CONTENT`), `ISSUE_PARAM_KEYS`, `ISSUE_MESSAGES_ES`, `renderIssue()`. Later units append their codes.
- [x] 1.8 RED: modify `packages/contracts/src/api-error.test.ts` to accept `WORKBOOK_FILE_REQUIRED`, `WORKBOOK_TOO_LARGE`, `WORKBOOK_UNSUPPORTED_MEDIA_TYPE` and still accept the two existing codes.
- [x] 1.9 GREEN: modify `packages/contracts/src/api-error.ts` with the three codes.
- [x] 1.10 Export the new modules from `packages/contracts/src/index.ts`; run `pnpm --filter @importer/web test` to confirm the closed enum change breaks nothing.
- [x] 1.11 Run the focused test command and `pnpm check`; record the measured lines.

## Phase 2: U2 Domain core and lint

Satisfies: workbook-contract (matching, cell model, tags), file-safety (cap defaults), workbook-validation-rules (image path syntax, parser policy), validation-report (truncation collector). Design D2, D3, D9, D14, D16.

- [x] 2.1 Modify `eslint.config.js`: add the catalog-workbook glob to `OTHER_MODULES` and a block forbidding `BUILT_INS`, `NEST`, `PRISMA` and `INFRASTRUCTURE` imports in the module's domain and application folders.
- [x] 2.2 Verify the negative gate: temporarily add a Node built-in import to a domain file, confirm `pnpm lint` fails naming it, then delete the temporary import.
- [x] 2.3 RED: create `apps/api/src/catalog-workbook/domain/workbook-limits.test.ts`: defaults (upload 20 MB, uncompressed 150 MB, 200 entries, ratio 100, 50,000 rows, 64 columns, 32,767 characters, 1,000 reported issues), frozen, override merge.
- [x] 2.4 GREEN: create `apps/api/src/catalog-workbook/domain/workbook-limits.ts` (`DEFAULT_WORKBOOK_LIMITS`).
- [x] 2.5 RED: create `domain/workbook-cell.test.ts` and `domain/match-key.test.ts`: `Imágenes` and padded variants match, case and accent folding, whitespace-only text is empty, number cell keeps raw text `19.9`, trimmed text.
- [x] 2.6 GREEN: create `domain/workbook-cell.ts` (cell model per design) and `domain/match-key.ts`.
- [x] 2.7 RED: create `domain/fields/decimal-field.test.ts` and `code-field.test.ts`: `1999.9999`, `19,99` comma, `1.12345` scale, `1000000000000` magnitude, `-1`, `0` warns, exponent, float artifact `19.989999999999998` is never rounded, number cell `0.1`; code field text kept, `12345` warns, 16 digits and `1.23457E+15` block, `00123` text clean.
- [x] 2.8 GREEN: create `domain/fields/decimal-field.ts` (adapts `Money`) and `domain/fields/code-field.ts`.
- [x] 2.9 RED: create `domain/fields/boolean-field.test.ts`, `integer-field.test.ts`, `barcode-field.test.ts`, `tags-field.test.ts`: spellings `Sí SI no Verdadero FALSO 1 0` and native boolean, `quizás` invalid; integers `3 -1 2.5 abc`, orden at least 1, stock 32-bit bound; barcode separators comma, semicolon, pipe, line break, inner space; tags ` verano, Verano ,, oferta ` gives verano and oferta, empty list, over 250 tags or a 256-character tag flagged.
- [x] 2.10 GREEN: create the four parsers under `domain/fields/`.
- [x] 2.11 RED: create `domain/fields/image-path.test.ts`: accepts `fotos/camisa 1.jpg` and `camisa.png`; rejects an absolute unix path, a drive path, a backslash traversal path, a URL and a trailing-separator path with the matching reason; control characters; purity under a file-system spy.
- [x] 2.12 GREEN: create `domain/fields/image-path.ts` (`checkImagePath`).
- [x] 2.13 RED: create `domain/issue-collector.test.ts`: counts stay exact above the cap, stores at most the cap per severity, errors kept before warnings, `truncated` flag, deterministic sort (file, sheet order, row, column, code).
- [x] 2.14 GREEN: create `domain/issue-collector.ts` (`IssueCollector`).
- [x] 2.15 Run the focused test command and `pnpm check`; record the measured lines (near budget: report, do not trim).

## Phase 3: U3a OOXML writer and fixture builder (delivered as U3a: 3.1 to 3.5, 3.8, 3.9 and U3a2: 3.6, 3.7, 3.10)

Satisfies: workbook-template (Identifier columns keep text, Usability aids: writer primitives only). Provides the crafted-file builder for U3b1, U3b2, U3c, U4. Design D5, D15.

- [x] 3.1 Verify on Node 24 that `zlib.crc32` and `deflateRawSync` exist (design item VS1, first half); record the result. Fallback: a small table-driven CRC-32 in the writer.
- [x] 3.2 RED: create `apps/api/src/catalog-workbook/infrastructure/ooxml/zip-writer.test.ts`: local headers, central directory and end record are well formed, CRC matches `zlib.crc32`, stored and deflated entries, same input gives identical bytes (stable SHA-256).
- [x] 3.3 GREEN: create `infrastructure/ooxml/zip-writer.ts`.
- [x] 3.4 RED: create `infrastructure/ooxml/package-writer.test.ts`: content types, workbook and relationship parts, text cells stored as strings (leading zero kept), text number format on chosen columns, a TRUE/FALSE list validation, frozen header, column widths, fixed document timestamps, aids can be switched off.
- [x] 3.5 GREEN: create `infrastructure/ooxml/sheet-xml.ts` and `package-writer.ts`.
- [x] 3.6 RED: create `apps/api/src/catalog-workbook/test-support/workbook-fixture-builder.test.ts`: builds a valid workbook and each crafted case (not a ZIP, CFB header, ZIP64, multi-disk, encrypted flag, method 12, traversal name, absolute name, duplicate name, lying sizes, overlapping entries, CRC mismatch, ratio bomb, N entries, macro part, external link, embedding, plain, shared, array and text-result formulas, error, date and rich-text cells, hidden sheet, row and column, sparse rows, long cell).
- [x] 3.7 GREEN: create `test-support/workbook-fixture-builder.ts` and `test-support/crafted-zip.ts` on top of the writer.
- [x] 3.8 RED: modify `apps/api/src/local-security/no-test-route-ships.test.ts` to assert `src/**/test-support/**` is excluded in `tsconfig.build.json`.
- [x] 3.9 GREEN: modify `apps/api/tsconfig.build.json` to exclude `src/**/test-support/**`.
- [x] 3.10 Run the focused test command, `pnpm build`, and confirm dist holds no test-support folder; record lines.

## Phase 4: U3b1 ZIP archive checks and U3b2 ZIP content checks

Satisfies: workbook-file-safety (Preflight before parsing, Archive caps, Ambiguous archives, Macros/links/embedded, Formulas package scan). Design preflight steps 1 to 7. Two PRs, each within the 400-line budget: U3b1 (tasks 4.1 to 4.6, 4.10) holds steps 1 to 6; U3b2 (tasks 4.7 to 4.9, 4.11) holds step 7. Task ids are kept stable, so the gate tasks 4.10 and 4.11 come last in their unit.

### U3b1 (branch `feat/workbook-u3b1-zip-archive-checks`, depends on U3a)

- [x] 4.1 (U3b1) Verify VS1 second half: `inflateRawSync` with `maxOutputLength` throws at the bound. Fallback: a chunked inflate that counts output and aborts. Record the result.
- [x] 4.2 Create `apps/api/src/catalog-workbook/ports/archive-inspector.port.ts` (`ArchiveInspector`, `Inspection`, `VerifiedArchive` with `formulaParts`, `ArchiveLimits`).
- [x] 4.3 RED (steps 1 to 5): create `infrastructure/zip/zip-preflight.int.test.ts` structure cases: random bytes `FILE_NOT_XLSX`, CFB header `FILE_ENCRYPTED_OR_LEGACY`, two end records or comment not at end, ZIP64 or multi-disk, 201 entries (limit 200, actual 201), cap override 10 versus 11 entries, encrypted flag, method 12, traversal and absolute names `ZIP_UNSAFE_ENTRY_NAME`, duplicate names after case folding `ZIP_AMBIGUOUS_ARCHIVE`, local header name mismatch, overlapping entries.
- [x] 4.4 GREEN: create `infrastructure/zip/central-directory.ts` (end record search, directory walk, local header checks, overlap check).
- [x] 4.5 RED (step 6): add cases: lying declared sizes rejected on real size, bomb beyond 150 MB or ratio 100 with limit and observed in params, inflation stops once the cap is crossed (bounded output observed), CRC and size mismatch, ratio rule only above 1 MiB.
- [x] 4.6 GREEN: create `infrastructure/zip/bounded-inflate.ts` and `infrastructure/zip/archive-preflight.ts` (steps 1 to 6).
- [x] 4.10 U3b1 gate: run `pnpm --filter @importer/api exec vitest run src/catalog-workbook/infrastructure/zip/zip-preflight.int.test.ts` and `pnpm check`; measure hand-written lines (budget 400, planned ~230) and record them. Stop here: U3b2 starts on a branch based on U3b1.

### U3b2 (branch `feat/workbook-u3b2-zip-content-checks`, depends on U3b1)

- [x] 4.7 RED (step 7): create `infrastructure/zip/content-scan.int.test.ts`: missing `[Content_Types].xml` or workbook part `FILE_NOT_XLSX`; `xl/vbaProject.bin`, macro content type and macrosheets `MACROS_NOT_ALLOWED` (renamed `catalogo.xlsx` still rejected); `xl/externalLinks/` and external relationship targets `EXTERNAL_LINKS_NOT_ALLOWED`; embeddings and ActiveX `EMBEDDED_CONTENT_NOT_ALLOWED`; sheet hyperlinks allowed; formula parts listed for plain, shared, array, dynamic and text-result formulas; several content findings returned together; a clean package yields no finding.
- [x] 4.8 GREEN: create `infrastructure/zip/content-scan.ts` and `infrastructure/zip/zip-archive-inspector.ts` implementing the port (archive checks from U3b1 plus the content scan) with `formulaParts`.
- [x] 4.9 Add the spy case: a crafted rejected archive never reaches a fake reader at the inspector level (the use-case level proof is in 11.9).
- [x] 4.11 U3b2 gate: run the focused test command (the whole zip folder) and `pnpm check`; measure hand-written lines (budget 400, planned ~200) and record them. Report any overrun, never trim.

## Phase 5: U3c Library spike

Satisfies: design D4 (decision protocol). No spec requirement is asserted here. Probes check the library's raw output on U3a fixtures that passed U3b1 and U3b2.

Exit criteria (all required before U4 starts):
- Candidates probed in order: SheetJS CE 0.20.3, then `modern-xlsx` 1.2.1. The own reader is the fallback and is not probed.
- Must pass: E2 leading-zero text in `s`, `str`, `inlineStr` unmodified; E3 numeric cells identifiable with decimal text recoverable; E4 booleans, errors, `t="d"`, rich text and whitespace-only cells distinguishable and unmodified; E5 hidden sheet, row and column flags; E6 original 1-based rows survive gaps; E7 ESM import under Node 24 and Vitest, no network, filesystem, eval or install scripts, acceptable license.
- Should pass: E1 formula cells flagged with coordinates (safety does not depend on it); E8 5,000-row by 20-column parse within 2 s, peak heap recorded at the cap size.
- Choice: first candidate passing every must-pass criterion; if both fail, fallback B (own preflight ZIP plus `fast-xml-parser`, version unresolved) behind the same port.
- Cap feedback: if peak heap at the 150 MB cap is above 1.5 GB, lower the uncompressed cap to the measured safe value.
- Outcome recorded in `spike-findings.md`, in Engram, and as a dated line under D4.

- [x] 5.1 Verify VS3 in a scratch directory outside the repository: pnpm 12 `file:` tarball integrity recorded in the lockfile, `minimumReleaseAge` and `allowBuilds` behaviour for `modern-xlsx`, WASM initialization under Vitest. Record results.
- [x] 5.2 Obtain the SheetJS 0.20.3 tarball into a new empty scratch directory, compute its SHA-256, then create `vendor/sheetjs/xlsx-0.20.3.tgz`, `vendor/sheetjs/xlsx-0.20.3.tgz.sha256` and the license file. Never reference a CDN URL as a dependency.
- [x] 5.3 Add `xlsx` as `file:../../vendor/sheetjs/xlsx-0.20.3.tgz` in `apps/api/package.json`, run `pnpm install`, confirm the tarball integrity appears in `pnpm-lock.yaml`.
- [x] 5.4 RED then GREEN: create `apps/api/src/catalog-workbook/infrastructure/spike/sheetjs-probe.int.test.ts` covering E1 to E8 against raw library output; record pass or fail per criterion.
- [x] 5.5 If SheetJS fails any must-pass criterion: remove it (dependency and tarball), add `modern-xlsx` at an exact registry version, create `infrastructure/spike/modern-xlsx-probe.int.test.ts` for E1 to E8.
- [x] 5.6 If both fail: record fallback B and its version choice for `fast-xml-parser`; no dependency is added in this unit.
- [x] 5.7 Measure E8 at the cap size; if the peak heap exceeds 1.5 GB lower `maxUncompressedBytes` in `domain/workbook-limits.ts` and update its test.
- [x] 5.8 If SheetJS won: RED then GREEN an int test `infrastructure/spike/vendor-integrity.int.test.ts` recomputing the tarball SHA-256 against the recorded file; add `vendor/**` to the ignore lists in `eslint.config.js` and `.prettierignore`.
- [x] 5.9 Write `openspec/changes/shopify-importer-02-workbook-and-validation-core/spike-findings.md`: candidate by criterion matrix, evidence test names, measurements, chosen version and hash, and the cap decision.
- [x] 5.10 Save the same findings to Engram under topic key `sdd/shopify-importer-02-workbook-and-validation-core/spike-findings`.
- [x] 5.11 Add a dated outcome line to decision D4 in `openspec/changes/shopify-importer-02-workbook-and-validation-core/design.md`.
- [x] 5.12 Delete probes and dependencies of every losing candidate; keep only the winner's probe (reused by U4). Run `pnpm check`. STOP: U4 does not start until CP1 is acknowledged.

## Phase 6: U4 Reader adapter

Satisfies: workbook-contract (Cell value model), file-safety (Formulas reader side, Sheet size caps), validation-report (no leak on reader failure). Adapter filename follows the spike: sheetjs, modern-xlsx, or own reader.

- [x] 6.1 Create `apps/api/src/catalog-workbook/ports/workbook-reader.port.ts` (`WorkbookReader`, `ReadResult`, `SheetLimits`) and the sheet types in `domain/workbook-cell.ts` if not already present.
- [x] 6.2 RED: create `apps/api/src/catalog-workbook/test-support/workbook-reader.contract.ts` and `infrastructure/reader/workbook-reader.int.test.ts`: text versus number, leading zeros, booleans, errors, dates, rich text, hidden sheets, rows and columns, sparse rows keep original numbers, whitespace untouched, 32,768-character cell, row and column caps give the file-level failure with limit and observed, plain, shared and array formulas flagged with coordinates.
- [x] 6.3 GREEN: create `infrastructure/reader/<chosen>-workbook-reader.ts` mapping to the domain cell model (the number `raw` text policy documented in a comment).
- [x] 6.4 RED: create `application/formula-guard.test.ts`: `formulaParts` non-empty with no flagged cell yields a file-level `FORMULA_NOT_ALLOWED`; both agreeing yields nothing extra.
- [x] 6.5 GREEN: create `application/formula-guard.ts`.
- [x] 6.6 RED: extend the reader int test: a library exception becomes a generic failure with no library message, stack or absolute path.
- [x] 6.7 GREEN: add the error mapping inside the adapter.
- [x] 6.8 Run the focused test command and `pnpm check`; record lines (fallback B may exceed 320: report).

## Phase 7: U5 Structure and Productos rules

Satisfies: workbook-contract (matching, Header row, Optional instructions and unknown columns), rules (Structure, Productos fields, Example products, Tags, Other cell kinds), file-safety (Formulas per cell, Sheet size caps per cell).

- [x] 7.1 RED: create `apps/api/src/catalog-workbook/domain/structure/resolve-sheets.test.ts`: ` Imágenes ` resolves to `Imagenes`, two colliding names `SHEET_DUPLICATE` and neither chosen, missing sheet `SHEET_MISSING` once with no row cascade, `Instrucciones` and unknown sheets ignored.
- [x] 7.2 GREEN: create `domain/structure/resolve-sheets.ts`.
- [x] 7.3 RED: create `domain/structure/resolve-headers.test.ts`: `TITULO`, `Handle`, padded `product_key` in any order, `HEADER_MISSING` for `handle`, `HEADER_DUPLICATE` for `SKU` and `sku`, absent `marca` silent, unknown header `notas` warns, issues use canonical names.
- [x] 7.4 GREEN: create `domain/structure/resolve-headers.ts`.
- [x] 7.5 RED: create `domain/structure/read-rows.test.ts`: blank and whitespace-only rows skipped without shifting numbers (row 4 stays 4), hidden sheet, row or column with data warns, formula cells give `FORMULA_NOT_ALLOWED` with sheet, original row and field (plain, shared, text result) and their rules are skipped while other cells are validated, error cell `CELL_ERROR_VALUE`, date cell `CELL_TYPE_UNEXPECTED`, boolean cell only valid in `gestionar_inventario`, reader cap failures become `SHEET_ROW_LIMIT_EXCEEDED`, `SHEET_COLUMN_LIMIT_EXCEEDED`, `CELL_TEXT_TOO_LONG` (cell with sheet, row, field).
- [x] 7.6 GREEN: create `domain/structure/read-rows.ts`.
- [x] 7.7 RED: create `domain/rules/productos-rules.test.ts`: empty `titulo` on row 5 gives `REQUIRED_FIELD_MISSING`, repeated key on row 3 refers to first row, case-insensitive handle duplicate on row 4, `camisa roja` invalid, `camisa-roja-2` valid, `EJEMPLO-REMERA` one `EXAMPLE_PRODUCT` warning and also the defect error, tag over 255 or more than 250 tags `TAG_LIMIT_EXCEEDED`, `a, A, b` no issue.
- [x] 7.8 GREEN: create `domain/product-row.ts` and `domain/rules/productos-rules.ts`; append Productos codes to the contracts catalog and its test.
- [x] 7.9 Run the focused test command and `pnpm check`; record lines.

## Phase 8: U6a Variantes identity and SKU

Satisfies: rules (SKU policy, Barcode and numeric identifier cells: sku part).

- [x] 8.1 RED: create `apps/api/src/catalog-workbook/domain/rules/variantes-identity-rules.test.ts`: empty sku `SKU_MISSING` warning only, same sku twice in one product `SKU_DUPLICATE_IN_PRODUCT` error, across products `SKU_DUPLICATE_ACROSS_PRODUCTS` warning, comparison trimmed as text, number cell `12345` `NUMERIC_IDENTIFIER_CELL`, 16 digits or exponent form `NUMERIC_IDENTIFIER_UNSAFE`, text `00123` clean, formula cell skipped.
- [x] 8.2 GREEN: create `domain/variant-row.ts` (identity part) and `domain/rules/variantes-identity-rules.ts`; append codes and Spanish entries in contracts.
- [x] 8.3 Run the focused test command and `pnpm check`; record lines.

## Phase 9: U6b Variantes options and combinations

Satisfies: rules (Variant structure and options).

- [x] 9.1 RED: create `domain/rules/variantes-options-rules.test.ts`: single row with empty options valid, two rows without options `OPTIONS_INCONSISTENT`, row 2 `Talla` versus row 3 `Color` flags row 3, names compared case-insensitively and position-wise, repeated `Talla`=`M` flags the second row `OPTION_COMBINATION_DUPLICATE`, name without value or value without name `OPTION_INCOMPLETE`, more than 250 variants `VARIANT_COUNT_HIGH`, value over 255 characters `OPTION_VALUE_TOO_LONG` warning.
- [x] 9.2 GREEN: create `domain/rules/variantes-options-rules.ts`; extend `domain/variant-row.ts` with option fields; append codes and Spanish entries.
- [x] 9.3 Run the focused test command and `pnpm check`; record lines.

## Phase 10: U7 Variantes values

Satisfies: rules (Decimal prices through Money, Barcode and numeric identifier cells: barcode part, Inventory and location).

- [x] 10.1 RED: create `domain/rules/variantes-price-rules.test.ts`: `1999.9999` clean, `19,99` `DECIMAL_AMBIGUOUS`, `1.12345` `DECIMAL_SCALE_EXCEEDED`, `1000000000000` `DECIMAL_MAGNITUDE_EXCEEDED`, exponent and text `DECIMAL_INVALID`, `-1` `PRICE_NEGATIVE`, `0` `PRICE_ZERO` warning, empty `precio` `REQUIRED_FIELD_MISSING`, compare-at 8 below price 10 warns `COMPARE_AT_BELOW_PRICE`, numeric cell `0.1` parsed exactly, float artifact blocked not rounded.
- [x] 10.2 GREEN: create `domain/rules/variantes-price-rules.ts`; append codes and Spanish entries.
- [x] 10.3 RED: create `domain/rules/variantes-barcode-rules.test.ts`: `7501,7502` `BARCODE_MULTIPLE` (also semicolon, pipe, line break, inner whitespace), number cell 16 digits and `1.23457E+15` `NUMERIC_IDENTIFIER_UNSAFE`, short number warns, text with leading zeros clean.
- [x] 10.4 GREEN: create `domain/rules/variantes-barcode-rules.ts`.
- [x] 10.5 RED: create `domain/rules/variantes-inventory-rules.test.ts`: spellings `Sí SI no Verdadero FALSO 1 0` and native true accepted, `quizás` `BOOLEAN_INVALID`, empty flag with stock 5 `INVENTORY_FLAG_REQUIRED`, empty flag and empty stock is false and silent, stock `3` accepted and `-1`, `2.5`, `abc` `STOCK_INVALID`, managed with empty stock `STOCK_INVALID`, managed without `ubicacion` `REQUIRED_FIELD_MISSING`, date cell in stock `CELL_TYPE_UNEXPECTED`.
- [x] 10.6 GREEN: create `domain/rules/variantes-inventory-rules.ts`; complete `domain/variant-row.ts`; append codes and Spanish entries.
- [x] 10.7 Run the focused test command and `pnpm check`; record lines.

## Phase 11: U8 Images, cross-sheet rules, assembly, use case

Satisfies: rules (Image rules, Cross-sheet references, Determinism), validation-report (Severities, Fingerprint, Truncation, Rejected shape, No leak), file-safety (reader not called, No network and no writes), endpoint (Unexpected failures at use-case level). Design D12, D13, D14.

- [x] 11.1 RED: create `domain/rules/imagenes-rules.test.ts`: empty `orden` and `0`, `-1`, `1.5` give `IMAGE_ORDER_INVALID`, `2` accepted, duplicate order flags the second row `IMAGE_ORDER_DUPLICATE`, gaps allowed, `IMAGE_PATH_INVALID` carries the reason param, `ALT_TOO_LONG` over 512, `IMAGE_COUNT_HIGH` over 250, `variant_sku` unknown `VARIANT_SKU_UNKNOWN`, matching two variants `VARIANT_SKU_AMBIGUOUS`, one match accepted.
- [x] 11.2 GREEN: create `domain/image-row.ts` and `domain/rules/imagenes-rules.ts`; append codes and Spanish entries.
- [x] 11.3 RED: create `domain/rules/cross-sheet-rules.test.ts`: Variantes row 7 with key `ZZ` and an Imagenes row with an empty or unknown key give `PRODUCT_KEY_UNKNOWN` at their rows, a product without Variantes gives `PRODUCT_WITHOUT_VARIANTS`.
- [x] 11.4 GREEN: create `domain/rules/cross-sheet-rules.ts`.
- [x] 11.5 RED: create `application/assemble-report.test.ts`: order file-level, sheet, row, column, only warnings is valid, one error and two warnings counts, 1,500 issues keep 1,000 with `truncated` and exact totals, 600 warnings before 600 errors keeps all errors, three defects in sheet then row order, same input gives identical lists, no tier B code, no Shopify claim.
- [x] 11.6 GREEN: create `application/assemble-report.ts`.
- [x] 11.7 RED: create `domain/catalog-draft.test.ts`: draft built only with zero errors, prices are `Money`, every element has `sourceRow`, the lowest `orden` image is the cover regardless of row order (3, 1, 2).
- [x] 11.8 GREEN: create `domain/catalog-draft.ts` and `domain/build-catalog-draft.ts`.
- [x] 11.9 RED: create `application/validate-workbook.use-case.test.ts` with fake inspector and reader spies: rejected archive never calls the reader and returns a file-level blocking issue with no data-row issues, random bytes `FILE_NOT_XLSX` parses with the contracts schema, reader throws gives `FILE_UNREADABLE` with no error text, stack or path in params or texts, formula guard wired, `fileSha256` passed through and present on rejected files, no network, file-system or database double fires for valid and invalid input, a second run carries nothing from the first.
- [x] 11.10 GREEN: create `application/validate-workbook.use-case.ts` and `catalog-workbook.tokens.ts` (`WORKBOOK_LIMITS`, port tokens).
- [x] 11.11 Run the focused test command and `pnpm check`; record lines (near budget: report, do not trim).

## Phase 12: U9 Template, module, GET route

Satisfies: workbook-template (all six requirements), endpoint (Template round trip at use-case level). Design D5, D6 header notes, VS4.

- [ ] 12.1 Verify VS4: Nest 12 `StreamableFile` sets the content type and attachment headers as needed; record. Fallback: set headers on the response explicitly.
- [ ] 12.2 RED: create `application/template-content.test.ts`: headers equal the contract lists in order, exactly two `EJEMPLO-` products (one simple with empty options, one with two or more consistent variants, each with an image row), no numeric `sku` or `codigo_barras` cells, barcode `0123456789012` as text, image paths pass `checkImagePath`, Spanish instructions mention required fields, boolean spellings, decimal format, one barcode, comma tags, image `orden`, deleting `EJEMPLO-` rows, and the fallback note when text format is unavailable.
- [ ] 12.3 GREEN: create `application/template-content.ts` and `application/generate-template.use-case.ts`.
- [ ] 12.4 RED: create `infrastructure/ooxml/ooxml-template-writer.int.test.ts`: identical bytes on two runs (stable SHA-256), read back through the reader shows four sheets, contract headers and text-kind identifiers, preflight reports no issue, no formulas, macros, links or embeddings, generation with aids switched off succeeds and validation is unchanged, the unmodified template through the use case gives zero errors and exactly two `EXAMPLE_PRODUCT` warnings.
- [ ] 12.5 GREEN: create `infrastructure/ooxml/ooxml-template-writer.ts` implementing `ports/template-writer.port.ts` (create the port first).
- [ ] 12.6 RED: create `infrastructure/http/template.int.test.ts` using `fetch` on an ephemeral loopback port: `GET api/workbook/template` returns 200, the XLSX content type, an attachment name ending `.xlsx`, `Cache-Control` no-store, a body starting with the ZIP signature, two downloads equal, no request body needed.
- [ ] 12.7 GREEN: create `infrastructure/http/workbook.controller.ts` (GET only), `catalog-workbook.module.ts` (`forRoot({ limits? })`, exports the validate use case); modify `apps/api/src/app.module.ts` to import `CatalogWorkbookModule.forRoot()`.
- [ ] 12.8 RED then GREEN: modify `apps/api/src/local-security/no-test-route-ships.test.ts` for the five imports and the controllers `HealthController` and `WorkbookController`; adjust its source expectations only as the test requires.
- [ ] 12.9 Run the focused test command and `pnpm check`; run the harness: boot the API against a temporary data directory and `curl --fail` the template route into the scratch directory, then check the first bytes. Record lines and output.

## Phase 13: U10 POST validate endpoint

Satisfies: workbook-validate-endpoint (Request errors, Upload size limit, Content problems are reports, Unexpected failures, Stateless, Honest scope, Round trip), validation-report (Fingerprint over HTTP). Design D6, D7, D13.

- [ ] 13.1 Verify VS2: Nest 12 Express leaves `application/octet-stream` and the XLSX MIME body unread, and `@Req()` streaming works under ESM. Fallback: register a raw body bypass for the route. Record the result.
- [ ] 13.2 RED: create `infrastructure/http/bounded-body-reader.test.ts`: SHA-256 of a known body, stops storing at the cap and drains the rest, `Content-Length` over the cap answered immediately with `Connection: close`, zero bytes yields the file-required error.
- [ ] 13.3 GREEN: create `infrastructure/http/bounded-body-reader.ts` (single-pass SHA-256 with `node:crypto`).
- [ ] 13.4 RED: create `infrastructure/http/workbook-validate.int.test.ts` on an ephemeral port: no body and zero bytes 400 `WORKBOOK_FILE_REQUIRED`, wrong media type 415, foreign origin 403 `ORIGIN_NOT_ALLOWED` and the file not processed, over 20 MB by header and by stream 413 `WORKBOOK_TOO_LARGE`, configured 1 KB limit versus 2 KB file 413, 1 MB valid file 200, valid workbook `valid` true, negative price 200 with `PRICE_NEGATIVE`, text file named `catalogo.xlsx` 200 with `FILE_NOT_XLSX` and null sheet, macro package 200 `MACROS_NOT_ALLOWED`, reader double that throws 200 `FILE_UNREADABLE` without a stack, same bytes twice equal reports with `fileSha256`, invalid then valid reports independent, no network, file or database double fires, no tier B code or Shopify claim, unmodified downloaded template 200 with only `EXAMPLE_PRODUCT` warnings.
- [ ] 13.5 GREEN: extend `infrastructure/http/workbook.controller.ts` with `POST api/workbook/validate`; create `infrastructure/http/workbook-exception.filter.ts` mapping request errors to `ApiError` bodies (400, 413, 415); wire the bounded body reader.
- [ ] 13.6 RED then GREEN: create `infrastructure/http/validate-perf.int.test.ts`: a 5,000-variant workbook from the builder validates in at most 5 s; log the measured time.
- [ ] 13.7 Run the focused test command and `pnpm check`; run the harness: boot the API, POST the downloaded template with `curl --fail`, confirm `valid` true and two `EXAMPLE_PRODUCT` warnings. Record lines and output.

## Phase 14: Final verification gate (rides on the U10 PR)

Docs: the design lists no README or documentation change for S1, so no README edit is made in this change.

- [ ] 14.1 Confirm in the apply progress that design.md lists no docs changes and that no README or doc file was touched.
- [ ] 14.2 Run `pnpm install --frozen-lockfile`; confirm exit 0 and the lockfile unchanged.
- [ ] 14.3 Run `pnpm check` (typecheck, lint, format check, tests); confirm all exit 0.
- [ ] 14.4 Run `pnpm build`; confirm exit 0 and that the API dist holds no `test-support` output and no probe files.
- [ ] 14.5 Leftovers check: no `.only` or `.skip` in tests, no temporary lint-gate file from 2.2, no losing-candidate dependency or probe, no scratch downloads inside the repository, no unused vendor file, `vendor/**` ignored by lint and Prettier only if SheetJS won, no Spanish text in API source outside the contracts catalog and the template content, no Node built-in imports in the contracts workbook files.
- [ ] 14.6 Confirm no task contacted Shopify and that runtime code of the module performs no network call or file write (search the module source).
- [ ] 14.7 Walk the proposal success criteria and tick each with its evidence in the apply progress (spike findings, crafted rejections, rule fixtures, template round trip, endpoint 4xx versus 200, green gates).

## Coverage Table (47 requirements, 122 scenarios)

| Capability: Requirement | Scenarios | Tasks |
|---|---|---|
| workbook-contract: Sheet and column constants | 2 | 1.2, 1.3 |
| workbook-contract: Accent-insensitive name matching | 3 | 2.5, 2.6, 7.1, 7.2, 7.3, 7.4 |
| workbook-contract: Header row and original row numbers | 2 | 7.5, 7.6 |
| workbook-contract: Optional instructions sheet and unknown columns | 2 | 7.1 to 7.4 |
| workbook-contract: Cell value model | 2 | 2.5, 2.6, 6.2, 6.3 |
| workbook-contract: One barcode and comma tags | 2 | 2.9, 2.10, 10.3, 10.4 |
| file-safety: ZIP preflight runs before parsing | 2 | U3b1: 4.3 to 4.6; U3b2: 4.7 to 4.9; 11.9, 11.10 |
| file-safety: Configurable archive caps | 4 | 2.3, 2.4, U3b1: 4.3 to 4.6 |
| file-safety: Ambiguous and unsafe archives | 2 | U3b1: 4.3, 4.4 |
| file-safety: Macros, external links, embedded content | 3 | U3b2: 4.7, 4.8, 13.4 |
| file-safety: Formulas are blocking | 3 | U3b2: 4.7, 4.8, 6.2 to 6.5, 7.5, 7.6, 11.9 |
| file-safety: Sheet size caps | 3 | 6.2, 6.3, 7.5, 7.6 |
| file-safety: No network and no writes | 2 | 11.9, 11.10, 13.4 |
| rules: Structure rules | 4 | 7.1 to 7.4 |
| rules: Productos required fields and keys | 4 | 7.7, 7.8 |
| rules: Example products warn without blocking | 2 | 7.7, 7.8, 12.4 |
| rules: Tag and text field checks | 2 | 2.9, 2.10, 7.7, 7.8 |
| rules: Cross-sheet references | 2 | 11.3, 11.4 |
| rules: Variant structure and options | 5 | 9.1, 9.2 |
| rules: SKU policy | 3 | 8.1, 8.2 |
| rules: Decimal prices through Money | 6 | 2.7, 2.8, 10.1, 10.2 |
| rules: Barcode and numeric identifier cells | 4 | 2.7, 2.8, 8.1, 8.2, 10.3, 10.4 |
| rules: Inventory and location | 5 | 2.9, 2.10, 10.5, 10.6 |
| rules: Image rules | 5 | 11.1, 11.2, 11.7, 11.8 |
| rules: Image path syntax check | 3 | 2.11, 2.12, 11.2 |
| rules: Other cell kinds | 2 | 7.5, 7.6 |
| rules: Rule evaluation deterministic and complete | 2 | 2.13, 2.14, 11.5, 11.6 |
| validation-report: Issue model | 3 | 1.4, 1.5 |
| validation-report: Spanish catalog in contracts | 3 | 1.6, 1.7 |
| validation-report: Severities and counts | 2 | 1.4, 1.5, 11.5, 11.6 |
| validation-report: File fingerprint | 2 | 11.9, 11.10, 13.2 to 13.5 |
| validation-report: Truncation with complete counts | 3 | 2.13, 2.14, 11.5, 11.6 |
| validation-report: Report shape for rejected files | 1 | 11.9, 11.10, 13.4 |
| validation-report: Report does not leak runtime details | 1 | 6.6, 6.7, 11.9, 11.10 |
| endpoint: Request errors are ApiError 4xx | 3 | 1.8, 1.9, 13.4, 13.5 |
| endpoint: Upload size limit | 3 | 13.2 to 13.5 |
| endpoint: Content problems are 200 reports | 4 | 13.4, 13.5 |
| endpoint: Unexpected failures do not leak | 1 | 11.9, 11.10, 13.4 |
| endpoint: Stateless and side-effect free | 3 | 11.9, 13.4 |
| endpoint: Limits and tier scope are honest | 1 | 11.5, 13.4 |
| endpoint: Template and validation round trip | 1 | 12.4, 13.4, 13.7 |
| template: Template download | 2 | 12.6, 12.7 |
| template: Template structure | 2 | 12.2, 12.3, 12.4 |
| template: Example products | 2 | 12.2 to 12.5 |
| template: Identifier columns keep text | 2 | 3.4, 3.5, 12.2, 12.4 |
| template: Template passes its own safety checks | 1 | 12.4, 12.5 |
| template: Usability aids | 1 | 3.4, 3.5, 12.4 |

Total: 47 requirements, 122 scenarios; none orphaned. U3c (spike, tasks 5.1 to 5.12) has no spec requirement of its own and exists to settle design D4. U3b1 (tasks 4.1 to 4.6, 4.10) and U3b2 (tasks 4.7 to 4.9, 4.11) together cover the file-safety archive and content requirements. Task total: 123 checkbox tasks (Phase 1: 11, 2: 15, 3: 10, 4: 11 of which U3b1 7 and U3b2 4, 5: 12, 6: 8, 7: 9, 8: 3, 9: 3, 10: 7, 11: 11, 12: 9, 13: 7, 14: 7). Design items to verify: VS1 (3.1, 4.1), VS2 (13.1), VS3 (5.1), VS4 (12.1).

Open points carried to apply (not blockers): the design and U1 add an ApiError 415 code the endpoint spec does not list (see 1.1); the codes for the unknown-header and hidden-content warnings are `HEADER_UNKNOWN` and `HIDDEN_CONTENT` (named in U1, emitted from U5), listed in the apply progress; the final uncompressed cap depends on the E8 measurement (5.7).
