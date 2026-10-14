```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:41d342cecbf620ea9fa118662d2d2e1f2b9bc615226b94b41fd1ccd3f5439f74
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 47/47
scenarios: 122/122
test_command: fnm exec --using=24 corepack pnpm check
test_exit_code: 0
test_output_hash: sha256:65ef514e813bdb44d2a2106d26bb5098b5dd8280623da47c9b2fb10d3f8e4fd7
build_command: fnm exec --using=24 corepack pnpm build
build_exit_code: 0
build_output_hash: sha256:adcdbc586fd18bc6c474df403735ecb159180d0b25532445eb1bc9df12c89147
```

## Verification Report

**Change**: shopify-importer-02-workbook-and-validation-core (S1)
**Version**: N/A (6 delta specs, 47 requirements, 122 scenarios)
**Mode**: Strict TDD (runner: `pnpm test`, Vitest)
**Branch**: develop at 4241471 (working tree clean before and after the verification runs)

The envelope counts "47/47" and "122/122" mean every requirement and scenario has a covering passing test, fully or partially; 6 scenarios are PARTIAL (listed below) and none is UNTESTED or FAILING. The envelope hashes are SHA-256 of the captured raw output files and are not reproducible byte for byte (vitest prints durations).

### Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 123 |
| Tasks complete | 123 |
| Tasks incomplete | 0 |

tasks.md has 123 `[x]` and 0 `[ ]`. Spec heading count (the native status rule): 47 `### Requirement:` (contract 6, file-safety 7, rules 14, report 7, template 6, endpoint 7) and 122 `#### Scenario:` (13, 19, 49, 15, 10, 16). apply-progress carries RED/GREEN tables per unit (U1 to U10), so Strict TDD evidence is present.

### Build and Tests Execution

Node 24 through `fnm exec --using=24 corepack pnpm ...`. Output was redirected to scratch files and the exit codes were read from a file, never through a pipeline.

| Command | Exit | Result |
|---------|------|--------|
| `pnpm install --frozen-lockfile` | 0 | lockfile up to date, no change |
| `pnpm check` (typecheck, lint, format:check, test) | 0 | all four stages Done |
| `pnpm build` | 0 | contracts, web (Vite), api (prisma generate and `nest build`) Done |

Tests: 3,741 passed, 0 failed, 0 skipped.

```text
packages/contracts test: Test Files  7 passed (7)    Tests  195 passed (195)
apps/web test:           Test Files 13 passed (13)   Tests  193 passed (193)
apps/api test:           Test Files 75 passed (75)   Tests 3353 passed (3353)
```

S0 baseline was 3,242 (44 + 193 + 3,005); S1 adds 499 tests (contracts +151, api +348). No `skip`, `todo` or `only` in the S1 sources (the two `skipIf` in workspace-invariants are S0 and evaluate to false).

**Coverage**: not available (no coverage provider). Not a failure.

Extra in-process evidence (no app start, no network, scratch dir only): the template was generated from the built `dist` output, mutated with Python zipfile into four variants, and run through `ValidateWorkbookUseCase` with the real inspector and SheetJS reader. These probes back warnings W3, W4 and W5. `parseDecimal` was also probed with 14 text and 4 number inputs. Nothing was written inside the repository by the probes.

### Spec Compliance Matrix

Legend: C = COMPLIANT (a passing test asserts the behavior), P = PARTIAL, U = UNTESTED, F = FAILING. Path shortcuts: CWB = apps/api/src/catalog-workbook, CS = packages/contracts/src.

**Summary: 116 COMPLIANT, 6 PARTIAL, 0 UNTESTED, 0 FAILING (122 scenarios). Requirements: 41 fully compliant, 6 with a PARTIAL scenario.**

#### workbook-contract (6 requirements, 13 scenarios: 13 C)

| Requirement / Scenario | Evidence | Status |
|---|---|---|
| Sheet and column constants / Constants are exposed | CS/workbook-schema.test.ts: "exposes the three data sheets...", "lists the Productos/Variantes/Imagenes columns in spec order", "flags exactly the required columns" | C |
| (same) / Contracts stay runtime-neutral | CS/workbook-schema.test.ts "imports no Node built-in module" (regex on `node:` only, see S4) | C |
| Accent-insensitive matching / Accented sheet name | CWB/domain/structure/resolve-sheets.test.ts "resolves an accented, padded name..."; match-key.test.ts | C |
| (same) / Header case, accents and order | CWB/domain/structure/resolve-headers.test.ts "maps case, accents, padding and any order..." | C |
| (same) / Ambiguous names after normalization | resolve-sheets.test.ts "reports colliding names once and chooses neither" | C |
| Header row and original row numbers / Blank rows keep numbering | CWB/domain/structure/read-rows.test.ts "skips blank and whitespace-only rows without shifting row numbers" (rows 2, 5); reader contract "keeps the original 1-based row numbers across gaps" | C |
| (same) / Whitespace-only row | read-rows.test.ts (same test) | C |
| Optional instructions sheet, unknown columns / Instructions sheet ignored | resolve-sheets.test.ts "ignores Instrucciones and unknown sheets"; ooxml-template-writer.int.test.ts (template validates with no Instrucciones issue) | C |
| (same) / Unknown column | resolve-headers.test.ts "warns about an unknown header with the text written in the file" | C |
| Cell value model / Numeric cell keeps its stored text | CWB/domain/workbook-cell.test.ts "keeps the raw text of a number cell"; reader contract "keeps text and numbers apart" (see W7) | C |
| (same) / Whitespace-only text | workbook-cell.test.ts "treats whitespace-only text as empty" | C |
| One barcode and comma tags / Tag normalization | CWB/domain/fields/tags-field.test.ts "trims, drops empties and removes case-insensitive duplicates keeping the first" | C |
| (same) / Empty tag list | tags-field.test.ts "gives an empty list for an empty cell" | C |

#### workbook-file-safety (7 requirements, 19 scenarios: 17 C, 2 P)

| Requirement / Scenario | Evidence | Status |
|---|---|---|
| ZIP preflight before parsing / Reader is not called | CWB/application/validate-workbook.use-case.test.ts "stops at a rejected archive: reader not called..." | C |
| (same) / Not an XLSX package | zip-preflight.int.test.ts "rejects bytes that are not a ZIP..."; content-scan.int.test.ts "rejects a package without content types or workbook part"; workbook-validate.int.test.ts "answers 200 with a file-level FILE_NOT_XLSX..." | C |
| Configurable archive caps / Too many entries | CWB/infrastructure/zip/zip-preflight.int.test.ts "caps the entry count with limit and actual in params" (201 entries, params 200 and 201) | C |
| (same) / Decompression bomb | same file "rejects a bomb above the ratio with limit and observed value"; "stops at the bound instead of producing the whole output"; the 150 MB path is proven with a shrunken cap, not 150 MB (see W6) | C |
| (same) / Lying declared sizes | "rejects declared sizes that lie, by the real size" (default cap gives ZIP_AMBIGUOUS_ARCHIVE; cap 2 gives ZIP_UNCOMPRESSED_TOO_LARGE with real size 3) | C |
| (same) / Cap override | "honours a cap override of 10 against 11 entries" | C |
| Ambiguous and unsafe archives / Traversal name | "rejects traversal and absolute names, backslashes, NUL and drive prefixes" | C |
| (same) / Duplicate entry | "rejects duplicate names, also after case folding" | C |
| Macros, external links, embedded / Macro workbook | content-scan.int.test.ts "rejects macros by part name, content type and macrosheet"; "never reaches the content scan or a reader when the archive is rejected"; workbook-validate.int.test.ts MACROS_NOT_ALLOWED | C |
| (same) / External link | content-scan.int.test.ts "rejects external links by part and by relationship target mode" | C |
| (same) / Renamed extension | content-scan.int.test.ts "still rejects macros in a file that someone renamed to catalogo.xlsx" | C |
| Formulas are blocking / Plain formula | CWB/domain/structure/read-rows.test.ts "reports a plain formula and skips only that cell" (sheet Variantes, row 2, field precio); reader contract "flags plain, shared, array and text-result formulas at their coordinates" | C |
| (same) / Shared formula | reader contract (B2 and dependent B3 both flagged) | C |
| (same) / Formula with text result | read-rows.test.ts "reports a text result formula..."; reader contract (D2) | C |
| Sheet size caps / Too many rows | reader contract "fails the file when a sheet has too many data rows or columns" (override 3; default 50000 asserted in workbook-limits.test.ts) | C |
| (same) / Too many columns | same test (override 3) | C |
| (same) / Long cell | reader contract "accepts a cell of exactly the cap and rejects one character more"; read-rows.test.ts "reports an over-long cell with its sheet and row" asserts `field: null`; the spec requires sheet, row and field | P |
| No network and no writes / Validation is side-effect free | validate-workbook.use-case.test.ts "gives zero errors and a draft...without network or file access" (fetch spy, fs mock); lint bans node built-ins in domain and application | C |
| (same) / Nothing persists | no test inspects a database or upload directory; evidence is structural (module has no persistence provider; fs and dns spies in the HTTP test) | P |

#### workbook-validation-rules (14 requirements, 49 scenarios: 48 C, 1 P)

Grouped rows below expand to the 49 scenarios.

| Requirement / Scenario | Evidence | Status |
|---|---|---|
| Structure rules / Missing sheet | resolve-sheets.test.ts "reports a missing sheet once, with no other issue" is unit level only; no pipeline test asserts that nothing cascades, and probe B shows a cascade on Imagenes (W3) | P |
| (same) / Missing required column | resolve-headers.test.ts "reports a missing required column by its canonical name" | C |
| (same) / Duplicate header | resolve-headers.test.ts "reports a duplicate header once and maps neither column" | C |
| (same) / Missing optional column | resolve-headers.test.ts "stays silent about an absent optional column" | C |
| Productos required fields / Missing title | CWB/domain/rules/productos-rules.test.ts "reports an empty titulo as REQUIRED_FIELD_MISSING with sheet, row and field" | C |
| (same) / Duplicate key and handle | productos-rules.test.ts "reports a repeated product_key pointing at the first row"; "reports a handle repeated with other casing" (separate tests, same rule) | C |
| (same) / Invalid handle, Valid handle | productos-rules.test.ts "rejects a handle with spaces and accepts one with digits and hyphens" | C, C |
| Example products / Example row | productos-rules.test.ts "warns once for an example product..."; ooxml-template-writer.int.test.ts (two examples, zero errors, one warning each) | C |
| (same) / Example row with a defect | productos-rules.test.ts same test (EJEMPLO-REMERA with empty titulo gives both issues) | C |
| Tag and text field checks / Tag too long | productos-rules.test.ts "warns when a tag is over 255 characters or there are more than 250 tags"; tags-field.test.ts | C |
| (same) / Duplicated tags | productos-rules.test.ts "de-duplicates tags without any issue" | C |
| Cross-sheet references / Orphan variant | CWB/domain/rules/cross-sheet-rules.test.ts "blocks a Variantes row whose key is not in Productos" | C |
| (same) / Product without variants | cross-sheet-rules.test.ts "blocks a product without Variantes rows, even with images" | C |
| Variant structure and options / Simple product | CWB/domain/rules/variantes-options-rules.test.ts "accepts a single row with empty options" | C |
| (same) / Multi-variant without options | "flags the second row when two rows of a product have no options" | C |
| (same) / Different option names | "flags row 3 when it names an option differently from row 2" | C |
| (same) / Repeated combination | "flags the second row of a repeated combination, ignoring case and spaces" | C |
| (same) / Name without value | "reports a name without value and a value without name" | C |
| SKU policy / Blank SKU, Duplicate in same product, Duplicate across products | CWB/domain/rules/variantes-identity-rules.test.ts "warns about an empty sku and nothing else"; "reports a sku repeated inside one product as an error..."; "warns about a sku repeated across products" | C, C, C |
| Decimal prices through Money / Valid price | CWB/domain/rules/variantes-price-rules.test.ts "accepts 1999.9999 exactly" | C |
| (same) / Comma decimal | variantes-price-rules.test.ts it.each "19,99 -> DECIMAL_AMBIGUOUS"; decimal-field.test.ts | C |
| (same) / Too many decimals and too large | it.each "1.12345 -> DECIMAL_SCALE_EXCEEDED", "1000000000000 -> DECIMAL_MAGNITUDE_EXCEEDED" | C |
| (same) / Negative and zero | it.each "-1 -> PRICE_NEGATIVE"; "warns about a zero price" | C |
| (same) / Compare-at below price | "warns when compare-at is below price" | C |
| (same) / Numeric price cell | "reads a number cell from its stored text" (0.1) | C |
| Barcode and numeric identifiers / Multiple barcodes | CWB/domain/rules/variantes-barcode-rules.test.ts it.each (comma, semicolon, pipe, line break, inner whitespace) | C |
| (same) / Short numeric identifier | variantes-identity-rules.test.ts "warns about a number cell and keeps its raw digits" | C |
| (same) / Long or exponent numeric identifier | variantes-barcode-rules.test.ts "blocks the unsafe number cell" (16 digits, 1.23457E+15); code-field.test.ts | C |
| (same) / Leading zeros as text | variantes-identity-rules.test.ts "keeps leading zeros of a text cell without any issue" | C |
| Inventory and location / Boolean spellings | CWB/domain/rules/variantes-inventory-rules.test.ts "accepts the flag %j as %s" (8 spellings incl. native true); boolean-field.test.ts | C |
| (same) / Invalid spelling | "blocks an unknown spelling" (quizás) | C |
| (same) / Blank flag | "requires the flag when there is stock"; "reads an empty flag with empty stock as false and silent" | C |
| (same) / Stock values | "blocks stock %s" (-1, 2.5, abc, above 32 bits) with flag "no"; "accepts stock 3..." | C |
| (same) / Managed without location | "requires ubicacion when inventory is managed" | C |
| Image rules / Order required, Order values, Duplicate order | CWB/domain/rules/imagenes-rules.test.ts it.each over orden values; "accepts orden 2 and allows gaps"; "flags the second image with a repeated orden of the same product" | C, C, C |
| (same) / Cover is the lowest order | CWB/domain/catalog-draft.test.ts "makes the lowest order the cover regardless of row order" | C |
| (same) / Variant SKU resolution | imagenes-rules.test.ts "blocks an unknown variant_sku"; "blocks a variant_sku that matches two variants"; "matches variant_sku on trimmed text..." | C |
| Image path syntax check / Accepted paths, Rejected paths | CWB/domain/fields/image-path.test.ts "accepts %j" and "rejects %j with %s" (each reason code incl. UNC, backslash traversal) | C, C |
| (same) / Purity | image-path.test.ts "never touches the file system, even for a path that exists" (the module imports no fs, so the spy is a weak guard; lint also bans node built-ins) | C |
| Other cell kinds / Error cell, Date cell | read-rows.test.ts "reports an error cell and a date cell, and marks them untrusted"; "accepts a boolean cell only in gestionar_inventario" | C, C |
| Deterministic and complete / Several defects | CWB/application/assemble-report.test.ts "lists three defects in sheet then row order"; issue-collector.test.ts "sorts by file, sheet order, row, column and code" | C |
| (same) / Repeat run | assemble-report.test.ts "gives identical lists for identical input"; workbook-validate.int.test.ts "returns equal reports..." | C |

#### validation-report (7 requirements, 15 scenarios: 14 C, 1 P)

| Requirement / Scenario | Evidence | Status |
|---|---|---|
| Issue model / Cell-level issue | CS/validation-report.test.ts "accepts a cell-level issue"; assemble-report.test.ts "carries the product key of the row..." and "renders message and suggestedAction from the catalog" | C |
| (same) / File-level issue | validation-report.test.ts "accepts a file-level issue with null sheet, row and field"; use-case test (sheet null, row null) | C |
| (same) / Schema validation | validation-report.test.ts it.each "rejects unknown code" (plus 6 other malformed shapes) | C |
| Spanish catalog / Every code has an entry | CS/issue-catalog.test.ts "has a non-empty message and action for %s" over all 59 codes | C |
| (same) / Interpolation | issue-catalog.test.ts "shows both numbers for DECIMAL-style limits" uses ZIP_TOO_MANY_ENTRIES; DECIMAL_SCALE_EXCEEDED declares no params and renders fixed text (W1) | P |
| (same) / No unresolved placeholders | issue-catalog.test.ts "declares param keys and leaves no placeholder for %s"; "declares every placeholder a template uses" | C |
| Severities and counts / Only warnings, One error | assemble-report.test.ts "is valid with only warnings"; "counts one error and two warnings"; validation-report.test.ts refine rejects valid with errors | C, C |
| File fingerprint / Known digest | bounded-body-reader.test.ts "returns exactly the received bytes with their SHA-256 from one pass"; workbook-validate.int.test.ts (64 hex, equal on repeat) | C |
| (same) / Rejected file | validate-workbook.use-case.test.ts "stops at a rejected archive..." (hash kept) | C |
| Truncation / Truncated report | assemble-report.test.ts "keeps 1,000 of 1,500 issues, flags truncation and keeps exact totals" | C |
| (same) / Errors kept first | assemble-report.test.ts "keeps every error when 600 warnings come before 600 errors" | C |
| (same) / Not truncated | issue-collector.test.ts "does not flag truncation when everything fits" | C |
| Report shape for rejected files / Not an XLSX | workbook-validate.int.test.ts FILE_NOT_XLSX test parses with ValidationReport | C |
| No leak / Unexpected reader failure | use-case test "turns a reader throw into FILE_UNREADABLE..."; sheetjs reader int test "turns a library exception into a generic failure..."; HTTP test "answers 200 with FILE_UNREADABLE and no stack" | C |

#### workbook-template (6 requirements, 10 scenarios: 10 C)

| Requirement / Scenario | Evidence | Status |
|---|---|---|
| Template download / Download | CWB/infrastructure/http/template.int.test.ts "answers 200 with the XLSX type, an attachment name and no-store"; "returns a ZIP package..." (PK 03 04) | C |
| (same) / Deterministic content | template.int.test.ts same bytes on every download; ooxml-template-writer.int.test.ts "writes identical bytes on every run" | C |
| Template structure / Sheets and headers | ooxml-template-writer.int.test.ts "reads back with four sheets, the contract headers..." (through the reader); template-content.test.ts | C |
| (same) / Instructions are Spanish and not data | template-content.test.ts "explains the rules in Spanish" (10 phrases); template validates with no Instrucciones issue | C |
| Example products / Template validates cleanly | ooxml-template-writer.int.test.ts "validates with zero errors and one EXAMPLE_PRODUCT warning per example" | C |
| (same) / Both shapes | template-content.test.ts "ships exactly two EJEMPLO- products, one simple and one with consistent variants" | C |
| Identifier columns keep text / Leading zero preserved | ooxml-template-writer.int.test.ts (barcode 0123456789012 read back as text) | C |
| (same) / No numeric example identifiers | same test (no number cell in sku and codigo_barras) | C |
| Passes its own safety checks / Preflight | ooxml-template-writer.int.test.ts "has no formulas, macros, links or embedded content and passes the preflight" | C |
| Usability aids / Aids absent | ooxml-template-writer.int.test.ts "generates with the aids switched off and validation is unchanged"; package-writer.test.ts aids on and off | C |

#### workbook-validate-endpoint (7 requirements, 16 scenarios: 14 C, 2 P)

| Requirement / Scenario | Evidence | Status |
|---|---|---|
| Request errors are ApiError 4xx / No file | workbook-validate.int.test.ts "answers 400 WORKBOOK_FILE_REQUIRED for no body and for zero bytes" | C |
| (same) / Zero-byte file | same test | C |
| (same) / Disallowed origin | same file "answers 403 for a foreign origin and never reads the file" asserts status 403 and no read call, not the code ORIGIN_NOT_ALLOWED (the code is asserted only in S0 guard tests) | P |
| Upload size limit / Oversize | "answers 413 at once for a Content-Length over 20 MB..."; "answers 413 for a streamed body over 20 MB, draining..." | C |
| (same) / Within limit | "accepts a valid workbook of 1 MB" | C |
| (same) / Configured limit | "honours a configured 1 KB limit against a 2 KB file" | C |
| Content problems are 200 reports / Valid workbook, Invalid data, Text file, Macro workbook | "reports a valid workbook as valid"; "answers 200 with PRICE_NEGATIVE..."; "answers 200 with a file-level FILE_NOT_XLSX..."; "answers 200 with MACROS_NOT_ALLOWED..." | C, C, C, C |
| Unexpected failures do not leak / Reader throws | "answers 200 with FILE_UNREADABLE and no stack when the reader throws" | C |
| Stateless / Repeatability | "returns equal reports with the same fileSha256 for the same bytes" | C |
| (same) / No side effects | "fires no file write, network lookup or database access": spies fs.writeFileSync, createWriteStream, promises.writeFile and dns.lookup; no database double despite the title | P |
| (same) / Independent requests | "keeps nothing from an invalid upload in the next valid one"; use-case "carries nothing from one run into the next" | C |
| Limits and tier scope honest / Scope | "is tier A only: a plain report with no Shopify claim or unknown code" (exact key set, no "shopify" text); assemble-report.test.ts | C |
| Template and validation round trip / Round trip | "accepts the unmodified downloaded template with only EXAMPLE_PRODUCT warnings" (real HTTP GET then POST) | C |

### Correctness (static)

| Requirement group | Status | Notes |
|---|---|---|
| 6 delta specs, 47 requirements | 41 implemented as specified, 6 with a gap | Gaps are W1 to W4 and the test gaps in W9 |
| Report shape | Compliant | Matches spec (summary has only error and warning counts; the design text listing products, variants, images counts was not built, spec wins) |
| 415 route | Extra | WORKBOOK_UNSUPPORTED_MEDIA_TYPE exists in contracts and the controller, tested, absent from the endpoint spec (known) |
| HIDDEN_CONTENT, HEADER_UNKNOWN warnings | Extra | In design D11, tested in read-rows.test.ts and resolve-headers.test.ts, not named in the delta specs |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 module layout | Yes | domain, application, ports, infrastructure/{zip,ooxml,reader,http}, test-support all present |
| D2 lint | Yes | `**/catalog-workbook/**` in OTHER_MODULES; domain and application block bans built-ins, Nest, Prisma and infrastructure (eslint.config.js). `pnpm check` lint exit 0 |
| D3 caps location | Yes, with W8 | frozen DEFAULT_WORKBOOK_LIMITS and `forRoot({ limits })`. The 250/255/512 soft limits are constants in rules |
| D4 library | Yes (spike) | SheetJS CE 0.20.3 vendored; tarball SHA-256 8dc73fc3...99fe8 recomputed with shasum and equal to the recorded file and the design text; vendor-integrity.int.test.ts passes 3 of 3 (sha256 file, lockfile sha512, Apache-2.0 license); lockfile entry present |
| D5 own OOXML writer | Yes | zip-writer.ts, package-writer.ts; deterministic bytes tested |
| D6 raw body transport | Yes | consequence: the spec clause "more than one file" cannot occur and has no test |
| D7 error split | Yes | 400, 413, 415 as ApiError; everything about the bytes is a 200 report |
| D8 synchronous pipeline | Yes | perf smoke 5,000 variants within 5 s passes |
| D9 decimals through Money | Yes | decimal-field.ts adapts Money; codes follow the spec (DECIMAL_*, PRICE_*), not the older PRICE_COMMA_SEPARATOR wording of the design table |
| D10 catalog in contracts | Yes | 59 codes, all with message, action and param keys; API renders via renderIssue |
| D11 codes rollout | Yes | HEADER_UNKNOWN and HIDDEN_CONTENT emitted from the structure units |
| D12 CatalogDraft | Yes | returned next to the report only with zero errors, never over HTTP |
| D13 SHA-256 in one pass | Yes | bounded-body-reader.ts hashes while streaming; application has no node:crypto |
| D14 truncation | Yes, with W5 | per-severity storage cap, sort, errors first, exact counts |
| D15 test-support excluded | Yes | no-test-route-ships.test.ts passes |
| D16 image path | Yes | pure checkImagePath in domain/fields |
| Ports and layering | Yes | three ports; module wires adapters with useFactory and tokens; no fs, net or http client imports in non-test runtime sources (only node:crypto, node:stream, node:zlib in infrastructure) |
| Deviations noted | | productKey on issues comes from a sheet:row index (null for header-row and file-level issues); cross-sheet rules run only if all three sheets resolve; IMAGE_PATH_INVALID text shows the raw reason code; ratio check applies only to entries above 1 MiB (design step 6 says so) |

### Issues

**CRITICAL (must fix before archive)**

None.

**WARNING (should fix or accept explicitly)**

- W1. Catalog interpolation scenario is not literally met. DECIMAL_SCALE_EXCEEDED declares no params and renders the fixed text "El número tiene más de 4 decimales". The spec scenario expects params limit 4, actual 5 interpolated into the text. The test proves interpolation with ZIP_TOO_MANY_ENTRIES instead. Fix: add limit and actual params to the decimal scale and magnitude codes, or amend the scenario.
- W2. CELL_TEXT_TOO_LONG has `field: null`. The spec says the issue must identify sheet, row and field. The reader fails before headers are resolved, so only sheet and row are known; read-rows.test.ts asserts the null.
- W3. Cascade when a sheet or required column is unusable. If Variantes is missing or has no usable header, `variants` is empty and every Imagenes row with a `variant_sku` gets a blocking VARIANT_SKU_UNKNOWN. Probe B (Variantes renamed away, one variant_sku added) produced SHEET_MISSING plus VARIANT_SKU_UNKNOWN on Imagenes row 2. The requirement says rules that need the missing part MUST be skipped and MUST NOT cascade. The scenario text only forbids Variantes row issues, so it is PARTIAL, not failing. An untrusted sku (formula in sku) has the same effect on variant_sku matching.
- W4. Formula detection is coarse. guardFormulas adds the file-level FORMULA_NOT_ALLOWED only when the archive scan saw a formula element and the reader flagged no cell anywhere. Probe A (a formula only in the Instrucciones sheet) returns valid true with 0 errors: the reader flags the cell, the guard passes, and readRows never inspects that sheet. The same holds for unknown sheets. The design claims "the preflight scan blocks the file anyway", which is not what the code does, and the spec says any formula cell MUST be blocking. No test covers this case. Fix: compare formula parts to sheets per sheet and block when a formula sits in an ignored sheet.
- W5. Issue order puts every error before every warning even when the report is not truncated (probe C: an Imagenes error is listed before the Productos EXAMPLE_PRODUCT warnings). The spec fixes errors before warnings only for truncation and demands file, sheet, row, column order otherwise. No test mixes severities in the untruncated order.
- W6. Compression ratio is applied per entry and only to entries above 1 MiB, and a test asserts a 500,000 byte bomb passes (zip-preflight.int.test.ts "applies the ratio rule only above 1 MiB"). The spec says overall ratio of at most 100:1 with no floor. In practice the 150 MB uncompressed cap bounds the exposure. The 150 MB inflation path is exercised only with a shrunken cap.
- W7. Numeric cell text policy. SheetJS drops the stored lexical form, so `raw` is the shortest round-trip text of the double (reader comment). The spec says "exact stored text". Values with 17 or more significant digits can differ from the file, and a stored number below 1e-6 arrives in exponent form and is reported DECIMAL_INVALID rather than DECIMAL_SCALE_EXCEEDED. Safe in practice (nothing is rounded, the float-artifact test blocks), but not literally the spec.
- W8. The tag limits (250 and 255), the option value limit (255), the alt limit (512) and the image count (250) are constants inside rule files. The spec calls them soft configurable defaults; only the WorkbookLimits caps are configurable.
- W9. Test gaps against MUST statements: (a) no route-level assertion of the ORIGIN_NOT_ALLOWED code for the validate route; (b) no test inspects a database or upload directory ("Nothing persists"), and the HTTP "no database access" test has no database double; (c) no pipeline test for the no-cascade requirement; (d) no test for a formula in an ignored sheet.
- W10. Over-cap upload races. Only the headers-only Content-Length path is tested (the test comment states a full send could end in EPIPE on the client). A client that sends a full oversize body with a large Content-Length can see a connection error instead of the 413; a chunked oversize body is drained to the end (not stored, but not cut off). Acceptable for a loopback single-user tool, but it is a known residual.

**SUGGESTION (nice to have)**

- S1. The Spanish catalog is an unreviewed first draft; have a native speaker review it. IMAGE_PATH_INVALID shows the raw reason code (for example IMAGE_PATH_ABSOLUTE) in the user text; map the six reasons to Spanish phrases.
- S2. Add WORKBOOK_UNSUPPORTED_MEDIA_TYPE (415) and the HIDDEN_CONTENT and HEADER_UNKNOWN codes to the specs on archive, and drop or reword the "more than one file" clause given the raw-body transport.
- S3. Money policy edge cases: "1 999" (space thousands) is DECIMAL_INVALID instead of DECIMAL_AMBIGUOUS; ".5" and "5." are rejected; "-0" and "0.0000" are accepted as zero with PRICE_ZERO. All are sensible, but document them in the instructions sheet.
- S4. Weak guards: the contracts neutrality test only matches `from 'node:`; the image-path purity test cannot fail because the module imports no fs. Consider an import allow-list test.
- S5. The row cap measures the sheet range, so a sheet with 50,001 formatted but blank rows would be rejected. Count populated rows instead.
- S6. state.yaml still shows proposal through verify as pending; the orchestrator should refresh the phases.
- S7. A test for an EJEMPLO- row with a duplicate product_key (warning on both rows) would pin the EXAMPLE_PRODUCT interplay with other rules.

### Known-risk checklist

| Risk | Finding |
|---|---|
| DECIMAL and PRICE codes vs spec | Match (probed: 1,999.99 and 1.000,50 ambiguous; exponent invalid; negative checked before scale; zero warns). Gaps only in W1 and W7 |
| Header matching accent-insensitivity | Correct (NFD strip, trim, lowercase); tests cover case, padding, order, accented sheet names; accents in headers covered by the matchKey test |
| Hidden content warnings | Emitted once per kind per sheet; hidden blank rows ignored; not in spec (S2). Hidden flags are skipped for a package without a styles part (documented) |
| EXAMPLE_PRODUCT interplay | Other rules still apply (tested); the template yields exactly 2 warnings |
| Truncation D14 and errors before warnings | Correct at the cap and counts exact; W5 for the untruncated order |
| Determinism | Equal reports and equal template bytes tested (int and unit); stable sort |
| No leak on reader failure | Covered at adapter, use case and HTTP levels |
| Over-cap EPIPE race | See W10 |
| isolated formula double-check | See W4 |
| No Shopify call and no file write | No fetch, http client, fs write or database import in runtime sources; the module has no persistence dependency; tests spy fs and dns; the template route writes nothing |
| Vendored tarball integrity | Test passes; recomputed shasum equals the recorded and design hash |

### Verdict

**PASS WITH WARNINGS**

0 CRITICAL, 10 WARNING, 7 SUGGESTION. All 123 tasks are complete; install, check and build exit 0; 3,741 of 3,741 tests pass; 116 of 122 scenarios are fully proven and 6 are partial (Missing sheet, Long cell, Nothing persists, Interpolation, Disallowed origin, No side effects). Next step: archive is allowed; the orchestrator may first open a small follow-up for W3, W4 and W5 (real behavior gaps) or record them as accepted deviations before archiving.

### Post-verify corrections

W3, W4 and W5 were corrected in unit U11 (tasks 15.1 to 15.3). W3: imagenes-rules.test.ts "does not resolve variant_sku when the variants are unavailable" and "does not call a sku unknown when its product has an untrusted variant sku", plus validate-workbook.use-case.test.ts "reports only SHEET_MISSING when Variantes is absent, with no variant_sku cascade". W4: formula-guard.test.ts (Instrucciones, unknown sheet, data sheet left to the reader) and use-case test "blocks a formula that sits only in Instrucciones or an unknown sheet". W5: issue-collector.test.ts "mixes severities in sheet, row and column order when nothing is cut" and assemble-report.test.ts "orders an Imagenes error after Productos warnings when nothing is cut".

W1, W2, W6 to W10 and the suggestions remain recorded as accepted limitations.
