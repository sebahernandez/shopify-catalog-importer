# Exploration: shopify-importer-02-workbook-and-validation-core (S1)

Slice S1 of the roadmap: template generation and download, XLSX reader, tier A (local) validation, error report model, decimal parser. Depends on S0 (archived). Labels: [V] verified by reading code or a page, [U] unverified, [D] proposed default.

## 1. Current state (S0 code to build on) [V]

- Workspace: pnpm 12, Node >=24, ESM. Packages `@importer/api` (NestJS 12, Prisma 7.10 + SQLite), `@importer/web` (React 19, Vite 8, Tailwind 4), `@importer/contracts` (zod 4, built to `dist`). Strict TDD (`pnpm test`), review budget 400 hand-written lines, co-located tests (`*.test.ts` unit, `*.int.test.ts` file/port/HTTP).
- `apps/api/src/shared-kernel/money/money.ts`: `Money.parse`/`tryParse` (error codes `AMBIGUOUS_SEPARATOR`, `INVALID_FORMAT`, `INVALID_SCALE`, `SCALE_EXCEEDED`), ASCII `^-?[0-9]+(\.[0-9]+)?$`, rejects commas, `+`, exponents, whitespace; has `isNegative`, `compare`, `toFixed`, `toString`. Negative-price policy is left to S1.
- `packages/contracts`: `ApiError` (code enum has only `HOST_NOT_ALLOWED`, `ORIGIN_NOT_ALLOWED`), `HealthResponse`, `MoneyString`. Contracts import zod only (no Node built-ins).
- `AppModule.forRoot({config, logger, extraModules})`; global prefix `api` (excluding `health`); global `LocalRequestGuard` guards non-safe methods (GET unguarded by origin, POST needs an allowed or absent Origin). `eslint.config.js` lists `OTHER_MODULES` for kernel layering; the new module name must be added.
- Web: same-origin client through the Vite proxy, Spanish copy only in `i18n/es.ts`, no `features/` folder yet.

## 2. Workbook contract (from the requirements document, sections 5 to 7)

Sheets `Productos`, `Variantes`, `Imagenes` plus an optional instructions sheet.

| Sheet | Columns |
|---|---|
| Productos | `product_key` (required), `handle` (required, unique in file), `titulo` (required), `descripcion_html`, `marca`, `tipo`, `etiquetas` |
| Variantes | `product_key`, `sku`, `precio`, `precio_comparacion`, `codigo_barras`, `opcion1_nombre`/`opcion1_valor` to `opcion3_*`, `gestionar_inventario`, `stock`, `ubicacion` |
| Imagenes | `product_key`, `archivo`, `orden`, `alt`, `variant_sku` |

Rules: `product_key` links the sheets; a simple product has exactly one variant row with empty options; `variant_sku` resolves exactly one variant of that product; SKU and barcode are text; prices are exact decimals with a documented format and never interpreted silently; currency belongs to the store (tier B); `stock` is absolute; locations resolve against Shopify (tier B); no formulas, macros or external links. Tier A detects missing sheets/columns, duplicate keys, broken references, duplicate handles, duplicate or ambiguous SKUs, repeated option combinations, inconsistent options, invalid prices or quantities and duplicate image orders (missing images need S3). Report row: sheet, original row, product, field, severity, message, suggested action; blocking errors versus warnings; no network, no writes.

Defaults: D6 one barcode per variant (a multi-value cell is a blocking error; the Shopify 2026-10 `barcodes: [{value, type?}]` shape is S5's job); D7 comma-delimited, trimmed, de-duplicated tags and an existing handle in Shopify is a tier B blocking conflict (S1 validates only format and uniqueness within the file).

## 3. Affected areas

- `packages/contracts/src/`: `workbook-schema.ts` (sheet and column constants), `validation-report.ts` (zod `ValidationIssue`, `ValidationReport` with `fileSha256`, summary, issues, `truncated`), `api-error.ts` (request-level codes such as `WORKBOOK_TOO_LARGE`, `WORKBOOK_FILE_REQUIRED`).
- `apps/api/src/catalog-workbook/` (new screaming module): `domain/` (cell model, parsers, rules, report builder), `application/` (`ValidateWorkbookUseCase`, `GenerateTemplateUseCase`), ports `WorkbookReader` and `TemplateWriter`, `infrastructure/` (zip preflight, reader adapter, template writer, controller). Routes `GET /api/workbook/template`, `POST /api/workbook/validate`. No database change.
- `shared-kernel/money` reused unchanged; the decimal parser is a cell-level adapter.
- `eslint.config.js`: add the module to `OTHER_MODULES`.
- `apps/web`: no screens in S1 (S6).
- A vendored library tarball with a recorded checksum (binary, not counted in the budget).

## 4. XLSX library spike plan

Candidates: SheetJS CE 0.20.3 (CDN tarball; npm `xlsx` is stale at 0.18.5), ExcelJS 4.4.0, read-excel-file 9.x (silently ignores formulas, excluded), an own thin OOXML reader (bounded inflate + fast-xml-parser), write-excel-file 4.1.1. `modern-xlsx` 1.2.1 (added 2026-10-14 at the user's request; MIT, Rust compiled to WASM, no runtime dependencies, first published 2026-03-03, one maintainer, 5 GitHub stars, claims data validation, frozen panes and formulas; formula exposure, text versus numeric cells, ZIP limits and macro handling are NOT documented in its README, so it is a spike candidate for both reading and template writing, not an accepted choice).

Spike deliverables: vendor the tarball with SHA-256; an own ZIP preflight independent of the library (central-directory parse, entry count, bounded real inflation, ratio, duplicate or traversal names, rejection of `vbaProject.bin`, `externalLinks/*`, `embeddings/*`, `activeX/*` and macro content types) run before the library sees the bytes; formula detection (plain, shared, array, dynamic, text-result) plus a library-independent `<f` scan; text preservation (leading-zero SKU or barcode as text versus numeric cells); numeric price cells as exact text; other cell kinds (booleans, errors, dates, rich text, merged, hidden sheets/rows/columns, formatted blank rows, whitespace-only cells); template round-trip; template authoring capability (text-formatted columns, TRUE/FALSE dropdown, frozen header, widths). Fallback: the own reader behind the same `WorkbookReader` port, changing one adapter file. Proposed caps [D]: upload 20 MB, uncompressed 150 MB, 200 entries, ratio 100:1, 50,000 rows per sheet, 64 columns, 32,767 characters per cell.

## 5. Approaches

| # | Approach | Verdict |
|---|---|---|
| A | Stateless module, SheetJS CE behind an own ZIP preflight, template writer chosen by the spike, report model in contracts, no DB, no web screens | Recommended, spike-gated |
| B | Own thin OOXML reader instead of SheetJS | Fallback if the spike fails |
| C | Persist upload and report now | Rejected: belongs to S4; S1 only exposes the file SHA-256 |

Upload transport (design call): multipart with memory storage and a size limit (precedent for S3) versus a raw octet-stream body with a counted stream. Request-level problems return `ApiError` 4xx; file-content problems return 200 with a report whose blocking issue has `sheet: null`.

## 6. Tier A rule set [D]

Structure (sheet and header matching trimmed, case-folded, accent-insensitive; duplicate headers; unknown columns as warnings; blank-row handling). Productos (required fields, duplicate `product_key` and `handle`, handle format, tag normalization). Variantes (existing product, at least one variant per product, `precio` Money-parsed and non-negative, `precio_comparacion` below `precio` as a warning, option consistency, duplicate combinations, SKU duplicates, single barcode, boolean `gestionar_inventario`, non-negative integer `stock`, `ubicacion` required when stock is managed). Imagenes (product exists, `archivo` required and syntactically safe, `orden` integer without duplicates, `alt` length, `variant_sku` resolves exactly one variant). Formulas, macros, external links and caps are blocking and file-level.

## 7. Suggested slicing (hand-written lines, about 30 percent uncertainty)

| Unit | Content | Est. |
|---|---|---|
| U1 | Contracts: report schema, column constants, `ApiError` codes | ~250 |
| U2 | Domain cell model and field parsers (decimal over `Money`, integer, boolean, text/tags), issue builder | ~350 |
| U3 | XLSX spike: vendored tarball, ZIP preflight, fixture builder, findings tests | ~380 (may split) |
| U4 | Reader adapter mapping to the port; formula, text and numeric rules | ~300 |
| U5 | Structure validation and Productos rules | ~300 |
| U6 | Variantes part 1: identity, SKU, options, combinations | ~350 |
| U7 | Variantes part 2: price, compare-at, barcode, inventory | ~300 |
| U8 | Imagenes rules, cross-sheet references, report assembly and caps | ~350 |
| U9 | Template generation, download endpoint, round-trip test | ~350 |
| U10 | Validate endpoint, limits, module wiring, error mapping, integration tests | ~350 |

## 8. Test strategy

Strict TDD; pure domain unit tests dominate; reader, preflight, template and endpoint tests are `*.int.test.ts`. A test-only OOXML builder writes minimal XLSX files with exact control of cell types, shared formulas, extra parts and crafted ZIPs (high ratio, many entries, lying sizes, overlapping entries); a small set of real fixtures is generated by a deterministic script. Fixture matrix covers valid simple and variant workbooks, leading zeros as text and numeric, formulas, macro and external-link files, zip bombs, oversize rows, structural errors, duplicates, broken references, option inconsistencies, price formats, boolean spellings, stock and image edge cases, not-a-ZIP, encrypted, empty, hidden sheets, whitespace and long cells. Real Excel behaviour cannot be verified here and the report must say so.

## 9. Risks

SheetJS distribution and advisory status (see research); parser differential between the preflight and the library; Excel loses leading zeros in General-format columns (the template must pre-format text columns, depends on writer capability); in-memory parsing; duplicated column knowledge (constants in contracts are the single source); Shopify per-field limits mostly undocumented (use soft limits); more than 250 variants or images per `productSet` unresolved (S1 warns with a code, S5 decides); template examples would import as real products; U3 and U6 may exceed the 400-line budget; extending the closed `ApiError.code` enum requires updating the web test in the same unit; very large reports need `truncated`; nothing in S1 touches Shopify.

## 10. Open product questions (proposed defaults)

1. Typical catalog size [hundreds to low thousands; synchronous].
2. SKU policy [optional; blank warns; duplicate in the same product blocks; across products warns].
3. Multi-location stock [one location per variant row in S1].
4. Template examples [two products with an `EJEMPLO-` key prefix and a non-blocking warning, plus an instructions sheet].
5. Image `orden` [required positive integer; the lowest is the cover; blank blocks].
6. Boolean spellings and blank handling for `gestionar_inventario`.
7. Accept `Imágenes` with accent and accent-insensitive headers [yes].
8. Image path syntax checks as a pure function owned by S1 [yes].
9. Where the Spanish message text lives [codes plus params in contracts; Spanish catalog in contracts].
10. Decimal limits in tier A (scale, magnitude, zero price) [scale at most 4, magnitude below 1e12, zero price warns].
11. Numeric cell in `sku` or `codigo_barras` [warning under 16 digits, error from 16].
12. SheetJS provenance [vendored tarball with a locally recorded checksum].
