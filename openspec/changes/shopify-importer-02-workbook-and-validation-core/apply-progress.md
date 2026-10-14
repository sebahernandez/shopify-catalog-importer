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
