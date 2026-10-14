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
