# Apply progress: shopify-importer-02-workbook-and-validation-core

## U1 split decision

U1 was first implemented as one unit and measured about 482 hand-written lines, over the 400-line budget. By user decision on 2026-10-14 it was delivered as two PRs: U1a (schema constants and issue catalog, tasks 1.1 to 1.3, 1.6, 1.7) and U1b (report model and ApiError codes, tasks 1.4, 1.5, 1.8 to 1.11). The one-piece draft was discarded; both units were rebuilt from it and re-verified on their own branches.

## U1a Schema constants and issue catalog: done

Branch: feat/workbook-u1a-schema-catalog (from develop). Strict TDD, Node 24.21.0, pnpm 12.11.2.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 1.1 | n/a | n/a | Recording only: design.md was aligned to the specs (issue `field`, `suggestedAction`, `summary.errorCount` and `warningCount`, flat params of string, number or boolean, the file-level codes). The specs win on any wording difference. The design and U1 add a third ApiError code `WORKBOOK_UNSUPPORTED_MEDIA_TYPE` (415) that the endpoint spec does not list. |
| 1.2 / 1.3 | Suite failed: cannot find module for workbook-schema | 7 tests pass | Schema constants. |
| 1.6 / 1.7 | Suite failed: cannot find module for issue-catalog | 51 tests pass (per-code rows) | 21 codes. |

### Test counts

Before: 3,242 (contracts 44, web 193, api 3,005). After U1a on its own branch: 3,296 (contracts 98, web 193, api 3,005). `pnpm check` exit 0.

### Measured hand-written lines

workbook-schema 59 + test 64, issue-catalog 168 + test 50, index 3 = 344. Within the 400 budget.

### Deviations and decisions for later units

- The interpolation test uses `ZIP_TOO_MANY_ENTRIES` (limit 4, actual 5); `DECIMAL_SCALE_EXCEEDED` belongs to a later unit and is not in the closed list.
- Param keys are U1a choices and later units that emit these codes must match them: `sheet`, `limit`, `actual` for the row and column limit codes; `sheet`, `kind` for `HIDDEN_CONTENT`; `sheet`, `column` for `HEADER_MISSING` and `HEADER_DUPLICATE`; `sheet`, `header` for `HEADER_UNKNOWN`; `limit`, `actual` for the ZIP size codes and `CELL_TEXT_TOO_LONG`.
- `renderIssue` substitutes in a single pass, blanks missing or undeclared placeholders and never re-expands braces inside param values.
- The workbook-schema test imports `node:fs` (test file only) to check the source has no `node:` import.
- The Spanish message text is a first draft and has not had a native-speaker review.
- `ISSUE_CODES` is a closed zod enum: later units must append their codes together with their `ISSUE_PARAM_KEYS` and `ISSUE_MESSAGES_ES` entries; the totality tests fail otherwise.

## U1b Report model and ApiError codes: done

Branch: feat/workbook-u1b-report-api-errors (from feat/workbook-u1a-schema-catalog). Strict TDD, Node 24.21.0, pnpm 12.11.2.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 1.4 / 1.5 | Suite failed: cannot find module for validation-report | 15 tests pass | `valid` iff `errorCount` is 0, enforced with a zod refine. `ValidationIssue.sheet` is an enum of the three data sheets (not any string). |
| 1.8 / 1.9 | 3 new ApiError cases failed (the enum rejected the codes) | 7 api-error tests pass | The two existing codes are still accepted. |
| 1.10 | n/a | web 193 pass | Exports added. The api typecheck broke on the closed enum (see deviations). |
| 1.11 | n/a | `pnpm check` exit 0 and `pnpm build` exit 0 | typecheck, lint, format:check, all tests. |

### Test counts

Before U1b: 3,296 (contracts 98, web 193, api 3,005). After: 3,317 (contracts 119, web 193, api 3,005).

### Measured hand-written lines

validation-report 37 + test 75, api-error +9 -2 and test +7 -1, index +5, request-policy +5 -1 = 141 changed lines. Within the 400 budget. U1a and U1b together are about 482, which is why U1 was split.

### Deviations

- `apps/api/src/local-security/request-policy.ts`: `RejectionCode` was `ApiError['error']['code']`, so widening the enum broke the api typecheck in the guard maps. It is now narrowed with `Extract` to the two guard codes (`HOST_NOT_ALLOWED`, `ORIGIN_NOT_ALLOWED`). This is outside the listed rollback boundary but the typecheck requires it.

## U2 split decision

U2 was first implemented as one unit and measured about 849 changed lines, double the 400-line budget (the overrun was not caught at a pair boundary because lines were measured only at the end). By user decision on 2026-10-14 it was delivered as three PRs: U2a (tasks 2.1 to 2.6, 2.13, 2.14), U2b (tasks 2.7, 2.8, 2.11, 2.12) and U2c (tasks 2.9, 2.10, 2.15). The one-piece draft was split by file without changing code; each unit was re-verified on its own branch.

## U2a Lint rule, limits, cell model, name matching and issue collector: done

Branch: feat/workbook-u2a-limits-cell-collector (from develop). Strict TDD, Node 24.21.0, pnpm 12.11.2.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 2.1 / 2.2 | Temporary `node:crypto` import in a domain file: `pnpm lint` failed with the built-in restriction naming `node:crypto` | Import removed, `pnpm lint` clean | The new block ignores `*.test.ts` so later purity tests can use a file-system spy. |
| 2.3 / 2.4 | Cannot find module `workbook-limits.js` | 3 tests pass | Adds `withLimits` for the override merge (frozen result). |
| 2.5 / 2.6 | Cannot find modules `match-key.js` and `workbook-cell.js` | 7 tests pass | `normalizeCell` returns `FieldValue` (text trimmed, blank and whitespace-only become `empty`). |
| 2.13 / 2.14 | Cannot find module `issue-collector.js` | 5 tests pass | Counts exact, cap per severity, errors first, deterministic sort. |

### Measured hand-written lines

312 insertions and 1 deletion across 9 files (source and tests, eslint.config.js +19 -1). Within the 400 budget.

### Decisions for later units

- `IssueCollector` takes a plain `CollectedIssue` (code is a string, sheet is a contracts `DataSheet`); column order comes from contracts `COLUMNS` and unknown fields sort after known ones. The use case renders issues later.
- Lint: the new block bans Node built-ins, Nest, Prisma and infrastructure imports in the module's domain and application folders, and ignores test files.

## U2b Decimal, code and image path parsers: done

Branch: feat/workbook-u2b-decimal-code-image-path (from feat/workbook-u2a-limits-cell-collector). Strict TDD, Node 24.21.0, pnpm 12.11.2.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 2.7 / 2.8 | Cannot find modules `decimal-field.js` and `code-field.js` | 21 tests pass | Money-based; the float artifact `19.989999999999998` fails the scale rule and is never rounded. Shared `field-result.ts` (`FieldResult`, `cellReason`). |
| 2.11 / 2.12 | Cannot find module `image-path.js` | 15 tests pass | Purity proved with a mocked `node:fs` whose spies are never called. |

### Measured hand-written lines

Seven files (field-result 16, decimal-field 44 and test 65, code-field 28 and test 42, image-path 42 and test 48) = 285 lines. Within the 400 budget.

### Decisions for later units

- Parsers return typed results with plain reason strings, never catalog codes. `PRICE_ZERO` is returned for any decimal field, so the rule reports it only for `precio`. `DECIMAL_AMBIGUOUS` replaces the design's `PRICE_COMMA_SEPARATOR`, as the spec says.
- Catalog codes later units must append to `ISSUE_CODES` with param keys and Spanish messages: `REQUIRED_FIELD_MISSING`, `DECIMAL_AMBIGUOUS`, `DECIMAL_INVALID`, `DECIMAL_SCALE_EXCEEDED`, `DECIMAL_MAGNITUDE_EXCEEDED`, `PRICE_NEGATIVE`, `PRICE_ZERO`, `COMPARE_AT_BELOW_PRICE`, `NUMERIC_IDENTIFIER_CELL`, `NUMERIC_IDENTIFIER_UNSAFE`, `IMAGE_PATH_INVALID` (reason in params), `CELL_ERROR_VALUE`, `CELL_TYPE_UNEXPECTED`, plus the other rule codes in the validation-rules spec.

## U2c Boolean, integer, barcode and tags parsers: done

Branch: feat/workbook-u2c-boolean-integer-barcode-tags (from feat/workbook-u2b-decimal-code-image-path). Strict TDD, Node 24.21.0, pnpm 12.11.2.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 2.9 / 2.10 | Cannot find the four parser modules | 32 tests pass | Reuses `field-result.ts`, `match-key.ts` and `parseCode`. |
| 2.15 | n/a | `pnpm check` exit 0 | Final U2 gate: contracts 119, web 193, api 3,088 (3,400 in total). |

### Measured hand-written lines

Eight files (boolean 30 and test 40, integer 27 and test 36, barcode 19 and test 28, tags 28 and test 43) = 251 lines. Within the 400 budget. U2a, U2b and U2c together are about 849 changed lines, which is why U2 was split.

### Decisions for later units

- Barcode separators follow the spec (comma, semicolon, pipe, any whitespace including line breaks); the design's slash is not a separator.
- Stock is a non-negative integer with an optional 32-bit `max`; `INTEGER_INVALID` maps to `STOCK_INVALID` (stock, max 2147483647) or `IMAGE_ORDER_INVALID` (orden, min 1) in the rules.
- Tags are trimmed and de-duplicated case-insensitively with `toLowerCase`; a tag number cell is read from its raw text.
- Catalog codes later units must append: `BARCODE_MULTIPLE`, `BOOLEAN_INVALID`, `STOCK_INVALID`, `INVENTORY_FLAG_REQUIRED`, `IMAGE_ORDER_INVALID`, `TAG_LIMIT_EXCEEDED`.

## U3a OOXML writer and fixture builder: partial (3.6, 3.7 and 3.10 remain)

Branch: feat/workbook-u3a-ooxml-writer (from develop with U1 and U2). Strict TDD, Node 24.21.0, pnpm 12.11.2. Stopped at a size boundary: the writer is done, the fixture builder and its crafted zips are not started.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 3.1 | n/a | VS1 first half passes | Node 24.21.0: `typeof zlib.crc32` is `function`, `deflateRawSync` works. No table-driven fallback needed. |
| 3.2 / 3.3 | Cannot find module `zip-writer.js` | 3 tests pass (after one fix) | First GREEN run failed on a wrong central-record layout (the test caught a mis-sized trailer and offset); fixed, then green. |
| 3.4 / 3.5 | Cannot find module `package-writer.js` | 6 tests pass | `packageParts` returns the parts so tests and the builder can inspect or alter them; `writePackage` zips them. |
| 3.8 / 3.9 | `expected ['src/**/*.test.ts'] to include 'src/**/test-support/**'` | 8 tests pass | `tsconfig.build.json` now excludes `src/**/test-support/**`. |

### Measured hand-written lines (after prettier, tests included)

- After 3.3: 111 (zip-writer 55, test 56).
- After 3.5: 307 (package-writer 70 and test 70, sheet-xml 56, zip-writer pair 111).
- After 3.9: 315 (adds 8 changed lines in no-test-route-ships.test.ts and tsconfig.build.json).

The builder pair (3.6 and 3.7, about 35 crafted cases) would not fit in the remaining 85 lines, so it moves to a follow-up unit (U3a2) on a branch based on this one. Task 3.10 is also deferred because it must confirm dist holds no test-support folder once that folder exists. Partial check done: `pnpm build` succeeds and dist has no test-support folder (none exists yet); full `pnpm test` is contracts 119, web 193, api 3,098 (3,410 total, up 10).

### Decisions for later units

- Cells are inline strings (`t="inlineStr"`, `xml:space="preserve"`), all text. Typed cells (numbers, formulas, errors, dates, rich text), hidden sheet, row and column flags, and sparse rows are NOT supported by `sheet-xml.ts` yet; the builder pair must widen `SheetDefinition` (or post-process the parts) test-first.
- Text format is style index 1 (built-in numFmtId 49) applied to the column and to body cells; it stays on when aids are off. Aids (frozen header, widths, TRUE/FALSE list) switch off with `{ aids: false }`.
- `writeZip` entries default to deflate; `method: 'stored'` is supported. Archives are classic ZIP, no comment, fixed DOS timestamp. Crafted-zip cases (ZIP64, multi-disk, flags, lying sizes, overlaps) need their own byte-level builder in `test-support/crafted-zip.ts`, since `writeZip` only produces well-formed archives.

### U3a cut decision and orchestrator correction

The agent stopped at the 3.5 boundary with 307 lines (315 after 3.9) because the fixture builder with about 35 crafted cases cannot fit in the remaining budget. By orchestrator decision the unit is cut: U3a keeps tasks 3.1 to 3.5, 3.8 and 3.9; the fixture builder (3.6, 3.7) and the final build check (3.10) move to a new unit U3a2 based on U3a.

The agent reported lint and prettier clean but did not run the type check; the orchestrator's `pnpm check` caught one error (`exactOptionalPropertyTypes` in `package-writer.test.ts`, `{ aids: boolean | undefined }` not assignable to `PackageOptions`) and fixed the test to omit the key when `aids` is undefined. After the fix `pnpm check` and `pnpm build` exit 0 (contracts 119, web 193, api 3,098: 3,410 in total).

Notes for U3a2: `sheet-xml.ts` supports only text cells, so number, formula, error, date and rich-text cells, hidden sheet/row/column flags and sparse rows must be added test-first; `writeZip` produces only well-formed archives, so the malformed cases (ZIP64, multi-disk, flags, lying sizes, overlaps, CRC mismatch) need a byte-level builder in `test-support/crafted-zip.ts`; task 3.10 must re-run once `test-support` exists to confirm dist holds no such folder.

## U3a2 Fixture builder and crafted ZIPs: complete (3.6, 3.7, 3.10)

Branch: feat/workbook-u3a2-fixture-builder (from develop with U1, U2, U3a). Strict TDD, Node 24.21.0, pnpm 12.11.2. Both case groups delivered; nothing remains.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| Group A1 (sheet-xml extension) | `row.length` fails on an undefined (sparse) row in `sheet-xml.ts`; 1 failed, 6 passed | 10 tests pass in the ooxml folder | `SheetDefinition` gains `hidden`, `hiddenRows`, `hiddenColumns`, undefined rows and raw cells (`{ t?, xml }`). |
| Group A2 (3.6/3.7 builder) | Cannot find module `workbook-fixture-builder.js` | 14 tests pass | One test expectation fixed (quotes are escaped by `escapeXml`), not the builder. Covers number, plain, shared, array and text-result formulas, error, date (`t="d"`), rich text, long cell, hidden sheet/row/column, sparse rows, macro part, external link, embedding. |
| Group B (3.6/3.7 crafted-zip) | Cannot find module `crafted-zip.js` | 6 tests pass (20 in test-support) | One GREEN failure: CRC xor produced a negative number; fixed with `>>> 0`. Covers not a ZIP, CFB header, ZIP64, multi-disk, encrypted flag, method 12, traversal, absolute and duplicate names, lying sizes, overlapping entries, CRC mismatch, ratio bomb, N entries. |
| 3.10 | n/a | `pnpm check` exit 0, `pnpm build` exit 0 | dist holds no test-support folder. Totals: contracts 119, web 193, api 3,119 (3,431 in total, up 21 from 3,410). |

### Measured hand-written lines (after prettier, tests included; added plus deleted)

- After A1: 50 (sheet-xml 28, package-writer 4, test 18).
- After A2: 187 (builder 56 and test 81 added).
- After Group B: 363 (crafted-zip 89 and test 87 added). Within the 400 budget.

### Decisions for later units

- Builder API: `buildWorkbook(sheets?, extraParts?)`, `workbookParts` (returns entries so a test can alter parts), cell helpers (`numberCell`, `formulaCell`, `sharedFormula`, `arrayFormula`, `textFormula`, `errorCell`, `dateCell`, `richTextCell`, `longCell`) and extra parts (`macroPart`, `externalLinkPart`, `embeddingPart`).
- Crafted archives are zero-argument builders except `ratioBomb(size)` and `manyEntries(count)`; they patch a well-formed `writeZip` archive. Lying sizes patches the uncompressed size to 1 in both headers; overlap points the second entry's local offset at the first; the ZIP64 case adds a locator and saturates the end record.
- The extra parts hold placeholder bytes and are not registered in the content types (enough for part-name scans).

## U3b1 ZIP archive checks: complete (4.1 to 4.6, 4.10)

Branch: feat/workbook-u3b1-zip-archive-checks. Strict TDD, Node 24.21.0. Design preflight steps 1 to 6 are delivered; step 7 (content) stays in U3b2.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 4.1 VS1 second half | n/a (probe) | Passed | On Node 24.21.0 `inflateRawSync` with `maxOutputLength` throws `ERR_BUFFER_TOO_LARGE` when output exceeds the bound; output of exactly the bound passes. No chunked fallback needed. |
| 4.3 structure cases | Cannot find module `archive-preflight.js` | 13 tests pass | Steps 1 to 5. |
| 4.5 step 6 cases | Cannot find module `bounded-inflate.js` | 20 tests pass | Lying sizes, ratio bomb, ratio floor, CRC, stored entries, bounded inflate unit cases. |
| 4.10 gate | n/a | `pnpm check` exit 0 | contracts 119, web 193, api 3,139 (3,451 in total, up 20). Focused file: 20 passed. |

### Measured size

Files (lines, blank lines and comments included): port 38, central-directory 140, archive-preflight 50, bounded-inflate 16, zip-preflight.int.test 168. Total 412 against the 400 budget (planned about 230): over by 12, reported and not trimmed.

### Decisions for later units

- Finding codes: encrypted flag gives FILE_ENCRYPTED_OR_LEGACY; ZIP64, multi-disk, two end records, comment not at end, method other than 0 or 8, local header problems, overlap, duplicates, CRC or real-size mismatch give ZIP_AMBIGUOUS_ARCHIVE; unsafe names give ZIP_UNSAFE_ENTRY_NAME. No new codes were added.
- Structural failures return a single finding (stop at the first problem). Step 6 also stops at the first bad entry.
- Port: `FileFinding` is `{ code: IssueCode; params }`; `ArchiveLimits` is the structural subset (maxEntries, maxUncompressedBytes, maxRatio) of the workbook limits; `ArchiveEntry` carries name, method, resolved dataOffset, compressedSize and size so U3b2 can inflate control parts; `formulaParts` is empty until U3b2. `ArchiveInspector.inspect(bytes, limits)` is declared, not implemented.
- `preflightArchive(zip: Buffer, limits)` is the internal entry point for U3b2's inspector class.
- When the bound is crossed the observed size is reported as bound plus 1 (a lower bound); the report never needs the true size.
- Ratio rule is per entry above 1 MiB, as in the design.

## U3b2 ZIP content checks: complete (4.7 to 4.9, 4.11)

Branch: feat/workbook-u3b2-zip-content-checks. Strict TDD, Node 24. Design preflight step 7 and the ArchiveInspector implementation are delivered.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 4.7 content cases | Cannot find module `zip-archive-inspector.js` (the new test file failed to load) | 15 tests pass | Required parts, macros, links, embedded content, hyperlinks allowed, formula parts, combined findings, clean package. |
| 4.8 implementation | n/a | Same 15 tests pass | `content-scan.ts` and `zip-archive-inspector.ts`. |
| 4.9 spy case | Part of the same RED file | Passes | A rejected crafted archive (lying sizes) returns not ok and a fake reader is never called. |
| 4.11 gate | n/a | `pnpm check` exit 0 | contracts 119, web 193, api 3,154 (up 15). Whole zip folder: 2 files, 35 tests passed. |

### Measured size

Lines, blank lines and comments included: content-scan 53, zip-archive-inspector 19, content-scan.int.test 147. Total 219 against the 400 budget (planned about 200). No U3b1 file was touched.

### Decisions for later units

- Content findings use existing codes only, with empty params, one finding per code, in the order macros, external links, embedded content. Missing `[Content_Types].xml` or `xl/workbook.xml` gives a single FILE_NOT_XLSX.
- Part names are matched case-insensitively. Macro content types are detected by the substrings macroEnabled, vbaProject and macrosheet in the content types part.
- `formulaParts` lists worksheet parts directly under xl/worksheets whose XML has an f element (prefix tolerant). It is only filled when there are no content findings.
- `ZipArchiveInspector` is not wired into any Nest module; U9 and U10 do that.
- The builder's extra parts are not registered in content types; macro content types are tested by replacing the content types part.

## U3c Library spike: complete (5.1 to 5.12)

Branch: feat/workbook-u3c-library-spike. Strict TDD where code was produced, Node 24. Full evidence in spike-findings.md.

### Outcome

SheetJS CE 0.20.3 passed every must-pass and should-pass criterion, so it is chosen. modern-xlsx was not probed and fallback B is not needed. Tarball SHA-256 8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8, vendored under vendor/sheetjs with the recorded hash file and the Apache-2.0 license; pnpm 12 recorded the sha512 integrity in the lockfile. The 150 MB uncompressed cap stays (peak RSS 1.21 GB at 156 MB, below 1.5 GB).

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 5.4 probe | Two failures from wrong fixture expectations (shared-formula shift; missing shared string table makes the sheet vanish) | 8 probe tests pass | Probes check raw library output on fixtures that first pass the real ZipArchiveInspector. |
| 5.8 integrity | Corrupted recorded hash gave one failure (expected hash against computed hash) | 3 tests pass | Recomputes sha256, checks the lockfile sha512, checks the license file. |

### Measured size

sheetjs-probe.int.test 206 lines, vendor-integrity.int.test 28 lines: 234 hand-written lines against the 400 budget (planned about 200). Vendored tarball, lockfile and records are excluded.

### Decisions and hazards for U4

- Parse with cellFormula, cellDates and cellStyles on. cellDates keeps t="d" distinct; cellStyles is required for hidden row and column flags.
- A t="s" cell with no shared string table makes the sheet disappear silently: U4 must treat a sheet name without a sheet object as a structure failure.
- cellStyles on a package with no styles part parses about 10 times slower; avoid it in that case.
- The lexical numeric value is not exposed: number raw is the shortest round-trip of the double.
- Dynamic array formulas are not covered by the fixture builder. The modern-xlsx parts of VS3 stayed unverified because SheetJS won.
- vendor is added to the ESLint and Prettier ignore lists. U4 does not start until CP1 is acknowledged.

## U4 Reader adapter: complete (6.1 to 6.8)

Branch: feat/workbook-u4-reader-adapter. Strict TDD, Node 24. SheetJS CE 0.20.3 (CP1 acknowledged). The adapter is not wired into any Nest module; U9 and U10 do that.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 6.2 contract and int test | Stub reader that always fails: 7 of 7 contract tests failed (FILE_UNREADABLE instead of the expected cells and failures) | 7 pass after 6.3 | The contract is reusable by any adapter through workbookReaderContract. |
| 6.4 formula guard | Test file failed to import the missing module | 3 pass after 6.5 | |
| 6.6 error mapping | The mapping shipped inside 6.3, so the tests passed at once. Mutation check: rethrowing in the catch made the exception test fail (the secret message surfaced), then restored | 3 error tests pass | Covers a thrown library error, a shared-string cell without its table, and a package without a styles part. |

### Measured size

Port 27, contract 160, adapter 142, int test 66, formula-guard 17, formula-guard test 28: 440 lines after Prettier, against the 400 budget (planned about 300). Over budget by 40 and the overrun is mostly tests (254 of 440) and the multi-line comments the policies need; nothing was trimmed.

### Decisions

- Failure shape: ok false with one finding plus an optional cell location (sheet, row, col). CELL_TEXT_TOO_LONG params are limit and actual only, as fixed in the catalog; the location travels beside the params so U5 can build the cell issue with sheet, row and field.
- Row cap counts data rows (last used row minus the header). Column cap counts the used range width. Both are checked from the sheet range before any cell is mapped. The cell cap counts UTF-16 code units.
- Exponent-form numbers: raw is String(double) unchanged, so 1e+21 and 1e-7 keep exponent form and the decimal and code rules reject them (design 10a, 11a). Documented in the adapter.
- cellStyles is switched off when the package has no styles part (about 10 times slower otherwise). Cost: hidden rows and columns are not reported for such a package. Packages from our template and from Excel always carry the part.
- Any exception from the library, a sheet name without a sheet object and an invalid date all give FILE_UNREADABLE with empty params; nothing of the library message, stack or path leaves the adapter.
- The adapter takes an optional parse function in its constructor (default XLSX.read) so tests can inject a throwing parser.
- formula-guard returns an empty list or one FORMULA_NOT_ALLOWED finding; per-cell formula reporting stays with the reader flags.
- Existing issue codes only; no new code needed. The blank kind is only produced for stub cells, which the reader never requests, so absent cells are simply missing from rows.

## U5a Sheet and header resolution: complete (7.1 to 7.4)

Branch: feat/workbook-u5a-sheets-headers (from develop at aa2c8ea). Strict TDD, Node 24. U5 was split in three by maintainer decision on 2026-10-14 after the structure work alone measured 494 lines: U5a (this unit: sheet builder, resolve-sheets, resolve-headers), U5b (read-rows and its catalog codes), U5c (Productos rules).

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 7.1 resolve-sheets test | Test file failed to import the missing module | 4 pass after 7.2 | |
| 7.3 resolve-headers test | Test file failed to import the missing module | 6 pass after 7.4 | First run failed one assertion because the test assumed header order; the map follows canonical order, so the test compares an object. |

### Measured size

Sheet builder 50, resolve-sheets 32 and test 55, resolve-headers 53 and test 67: 257 lines after Prettier. Nothing was trimmed.

### Decisions

- resolveSheets returns a map of the resolved data sheets; a missing or colliding sheet is reported once and left out of the map.
- resolveHeaders returns the column map and a usable flag (false when a required column is missing or duplicated); a duplicated header is reported once and mapped to neither column.
- A pure sheet builder in the test-support folder builds in-memory sheets for the domain tests (shared by the three structure test files).

## U5b Row reading: complete (7.5 and 7.6)

Branch: feat/workbook-u5b-read-rows (from develop at 6250631, after U5a). Strict TDD, Node 24. Second of the three parts of U5.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 7.5 read-rows test | Test file failed to import the missing module | 10 pass after 7.6 | Passed at the first run. |

### Measured size

Read-rows 93 and test 130: 223 lines, plus 14 in the contracts catalog. Nothing was trimmed.

### Decisions

- New catalog codes: CELL_ERROR_VALUE and CELL_TYPE_UNEXPECTED (no params). The generic catalog test already covers every new code.
- HIDDEN_CONTENT message reworded to contenido oculto con datos (kind), because the kind also covers a hidden sheet; kind values are columnas, filas and hoja, once per sheet each.
- readRows returns SourceRow records with the original row, trimmed cells and an untrusted field set. Formula, error, date and misplaced boolean cells are reported per cell with sheet, row and field, then left out of the cells, so rules skip them and the field parsers never see them. A formula cell counts as data even if its cached value is blank.
- reportReadFailure maps a reader failure to an issue. For CELL_TEXT_TOO_LONG the field is null: the reader fails before any header exists and the catalog params are only limit and actual, so the column cannot be named reliably. Sheet and row are set. Accepted by the maintainer.

## U5c Productos rules: complete (7.7 to 7.9)

Branch: feat/workbook-u5c-productos-rules (from develop at dce39b7, after U5b). Strict TDD, Node 24. Last of the three parts of U5.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 7.7 productos-rules test | Test file failed to import the missing module | 8 pass after 7.8 | Passed at the first run. |
| 7.9 | n/a | pnpm check exit 0 (api 58 files, 3206 tests), contracts 7 files, 135 tests | |

### Measured size

Rules 82 and test 101, product-row 9: 192 lines after Prettier, plus 38 in the contracts catalog. Nothing was trimmed.

### Decisions

- New catalog codes: REQUIRED_FIELD_MISSING (param field, reusable by later rules), PRODUCT_KEY_DUPLICATE and HANDLE_DUPLICATE (param firstRow), HANDLE_INVALID_FORMAT, EXAMPLE_PRODUCT, TAG_LIMIT_EXCEEDED (no params, the limits are in the message). The spec leaves the names unspecified; these are chosen here.
- productosRules(rows, sink) returns ProductRow records (sourceRow, productKey, handle, title, tags). A field is undefined when empty, untrusted or invalid; an invalid-format handle is undefined and is not checked for duplicates.
- Fields in the untrusted set are not read and not reported as missing. product_key duplicates compare the trimmed text exactly; handles compare case-insensitively. The tag warning comes from the existing tags parser.

## U6a Variantes identity and SKU rules: complete (8.1 to 8.3)

Branch: feat/workbook-u6a-variantes-identity (from develop at 8bd49c5). Strict TDD, Node 24.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 8.1 variantes-identity-rules test | Test file failed to import the missing module | 8 pass after 8.2 | One case failed first (untrimmed key), fixed by trimming in the rule. |
| 8.3 | n/a | pnpm check exit 0 (api 59 files, 3214 tests), contracts 7 files, 145 tests, web 193 | |

### Measured size

Rules 69, test 102, variant-row 7: 178 lines after Prettier, plus about 30 in the contracts catalog. Nothing was trimmed.

### Decisions

- New catalog codes: SKU_MISSING (warning), SKU_DUPLICATE_IN_PRODUCT (error) and SKU_DUPLICATE_ACROSS_PRODUCTS (warning), the last two with param firstRow; NUMERIC_IDENTIFIER_CELL and NUMERIC_IDENTIFIER_UNSAFE without params.
- variantesIdentityRules(rows, sink) returns VariantRow records (sourceRow, productKey, sku). sku is undefined when empty, untrusted or unsafe; a number cell with at most 15 digits keeps its raw digits and warns.
- The numeric-cell policy comes from parseCode; the rule maps its reason and warning strings to catalog codes. Cell-kind reasons are ignored because readRows already reported those cells and marked them untrusted.
- Rows with an empty or untrusted product_key still get the missing and numeric checks but skip duplicate checks; the empty key itself is PRODUCT_KEY_UNKNOWN in the cross-sheet rule (U8), so nothing is reported here.
- Duplicate-across-products points at the first row that used the sku in any product.

## U6b Variantes options and combinations: complete (9.1 to 9.3)

Branch: feat/workbook-u6b-variantes-options (from develop at 905a593). Strict TDD, Node 24.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 9.1 variantes-options-rules test | Test file failed to import the missing module | 10 pass after 9.2 | Written first, 10 cases. |
| 9.3 | n/a | pnpm check exit 0 (api 60 files, 3224 tests), contracts 7 files, 155 tests, web 193 | |

### Measured size

Rules 145, test 137, variant-row 14: 296 lines after Prettier, plus 32 in the contracts catalog. Nothing was trimmed.

### Decisions

- New catalog codes: OPTIONS_INCONSISTENT, OPTION_INCOMPLETE and OPTION_VALUE_TOO_LONG (no params), OPTION_COMBINATION_DUPLICATE (param firstRow), VARIANT_COUNT_HIGH (param count). Severities: the first, second and third are error, error, warning; VARIANT_COUNT_HIGH is a warning.
- variantesOptionsRules(rows, variants, sink) returns the identity VariantRow records extended with optional opcion1_nombre to opcion3_valor (trimmed; set only for a complete, trusted pair).
- Rows are grouped by the trimmed productKey of the identity output; rows without one are skipped (U8 reports PRODUCT_KEY_UNKNOWN). A row with any untrusted option cell, or an incomplete pair, is left out of the consistency and duplicate checks to avoid cascades.
- OPTIONS_INCONSISTENT compares names (matchKey, by position) with the first judged row of the product and flags each differing row; when that first row has no names and the product has two or more rows, only the second row is flagged. OPTION_COMBINATION_DUPLICATE compares matchKey values and points at the first row.
- VARIANT_COUNT_HIGH is reported once per product at the 251st row (field null) with the total count. The 250 and 255 limits are constants in the rule, not yet configurable.

## U7a Variantes price rules: complete (10.1 and 10.2); 10.3 to 10.7 move to U7b

Branch: feat/workbook-u7-variantes-values (from develop at ca3c9f7). Strict TDD, Node 24. Stopped at the price boundary because the size budget would be exceeded. U7 was split in two by maintainer decision on 2026-10-14: U7a (this unit: price rules, the whole U7 catalog) and U7b (barcode and inventory rules, tasks 10.3 to 10.7).

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 10.1 variantes-price-rules test | Test file failed to import the missing module | 15 pass after 10.2 | Written first. |
| 10.2 | n/a | pnpm check exit 0 (api 61 files, 3239 tests), contracts 7 files, 177 tests, web 193 | All 11 U7 codes were added to the catalog now, so later modules need no catalog change. |

### Measured size

Price rules 53, price test 104, variant-row 5: 162 lines, plus 71 in the contracts catalog (all 11 U7 codes): 233 lines. Nothing was trimmed.

### Decisions

- New catalog codes (no params; REQUIRED_FIELD_MISSING already existed): DECIMAL_AMBIGUOUS, DECIMAL_INVALID, DECIMAL_SCALE_EXCEEDED, DECIMAL_MAGNITUDE_EXCEEDED, PRICE_NEGATIVE, PRICE_ZERO (warning), COMPARE_AT_BELOW_PRICE (warning), BARCODE_MULTIPLE, BOOLEAN_INVALID, STOCK_INVALID, INVENTORY_FLAG_REQUIRED. The last four have no rule yet.
- variantesPriceRules(rows, variants, sink) returns the VariantRow records extended with price and compareAtPrice (Money, undefined when empty, untrusted or invalid).
- PRICE_ZERO is reported only for precio; a zero precio_comparacion is silent on its own and warns COMPARE_AT_BELOW_PRICE when precio is higher. An untrusted precio is not reported as missing.
- Pending: 10.3 to 10.6 (barcode, inventory) and 10.7.

## U7b Variantes barcode and inventory rules: complete (10.3 to 10.7)

Branch: feat/workbook-u7b-variantes-barcode-inventory (from develop at e5b94ab). Strict TDD, Node 24. No contract changes: the catalog already had every code used.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 10.3 barcode test | Test file failed to import the missing module | 11 pass after 10.4 | Written first. |
| 10.5 inventory test | Test file failed to import the missing module | 21 pass after 10.6 | Written first. |
| 10.7 | n/a | pnpm check exit 0 (api 63 files, 3271 tests; contracts 7 files, 177 tests; web 13 files, 193 tests) | One lint fix and one prettier run on the inventory test. |

### Measured size

Barcode rule 36, barcode test 74, inventory rule 60, inventory test 123, variant-row 27 (+8 this unit): 320 lines including the variant-row growth. Nothing was trimmed.

### Decisions

- variantesBarcodeRules and variantesInventoryRules follow the price rule shape: (rows, variants, sink) returning VariantRow[] extended with barcode, and with manageInventory, stock and location.
- Codes used: BARCODE_MULTIPLE, NUMERIC_IDENTIFIER_UNSAFE (errors), NUMERIC_IDENTIFIER_CELL (warning), BOOLEAN_INVALID, STOCK_INVALID, INVENTORY_FLAG_REQUIRED (field gestionar_inventario), REQUIRED_FIELD_MISSING (field ubicacion, param field).
- Stock is an integer up to 2147483647. An empty flag with valid stock is INVENTORY_FLAG_REQUIRED and manageInventory stays undefined; an empty flag with empty stock is false. Untrusted or invalid stock never triggers a flag or managed-stock cascade; an untrusted flag skips every dependent check.
- A flag of false with stock present is accepted silently. Location is trimmed; an untrusted ubicacion is not reported as missing.

## U8a Imagenes rules and cross-sheet rules: complete (11.1 to 11.4)

Branch: feat/workbook-u8a-images-rules (from develop at 825b0af). Strict TDD, Node 24. U8b (11.5 to 11.8) and U8c (11.9 to 11.11) are not started.

### TDD evidence

| Task | RED observed | GREEN | Notes |
|------|--------------|-------|-------|
| 11.1 imagenes test | Test file failed to import the missing module | 16 pass after 11.2 | Written first, with image-row.ts and the catalog codes. |
| 11.3 cross-sheet test | Test file failed to import the missing module | 7 pass after 11.4 | Written first. |

### Measured size

image-row 13, imagenes rule 111, imagenes test 148, cross-sheet rule 39, cross-sheet test 90: 401 lines hand-written, excluding the catalog records. Nothing was trimmed.

### Decisions

- New catalog codes: IMAGE_ORDER_INVALID, IMAGE_ORDER_DUPLICATE (firstRow), IMAGE_PATH_INVALID (reason), ALT_TOO_LONG (warning), IMAGE_COUNT_HIGH (warning, count), VARIANT_SKU_UNKNOWN, VARIANT_SKU_AMBIGUOUS, PRODUCT_KEY_UNKNOWN, PRODUCT_WITHOUT_VARIANTS.
- imagenesRules(rows, variants, sink) returns ImageRow[] (sourceRow, productKey, path normalized, order, alt, variantSku set only for a unique match). Rows without product_key skip the sku, duplicate and count checks and are left to the cross-sheet rule. Untrusted fields are skipped silently.
- IMAGE_COUNT_HIGH is reported once per product at the first row over 250, field null. IMAGE_ORDER_DUPLICATE is on the later row with the first row as param. Cover selection is left to the draft (U8b).
- crossSheetRules(products, variants, images, sink) returns nothing and reports PRODUCT_KEY_UNKNOWN on field product_key for an empty, untrusted or unknown key (an untrusted key is indistinguishable from an empty one in the typed rows). PRODUCT_WITHOUT_VARIANTS is once per key, on the first Productos row; a Productos row without key is skipped. Images do not count as variants.
- Pending: U8b and U8c.
