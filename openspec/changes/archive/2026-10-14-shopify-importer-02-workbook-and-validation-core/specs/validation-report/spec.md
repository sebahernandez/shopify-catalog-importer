# Validation Report

Delta spec (new capability). The report returned for every readable upload. Schemas and the Spanish message catalog live in the contracts package. Decisions: 9a.

## ADDED Requirements

### Requirement: Issue model

A `ValidationIssue` MUST carry: `severity` (`error` or `warning`), `code` (a stable identifier from a closed list), `params` (a flat map of string, number or boolean values), `sheet` (canonical sheet name or `null`), `row` (original 1-based row number or `null`), `field` (canonical column name or `null`), `productKey` (string or `null`), `message` (Spanish text) and `suggestedAction` (Spanish text). `message` and `suggestedAction` MUST be derived from `code` and `params` through the shared catalog. Issues MUST be defined as zod schemas in the contracts package.

#### Scenario: Cell-level issue

- GIVEN a blocking price error on Variantes row 4
- WHEN the issue is built
- THEN it has severity `error`, sheet `Variantes`, row 4, field `precio`, the product key and non-empty Spanish `message` and `suggestedAction`

#### Scenario: File-level issue

- GIVEN a macro workbook
- WHEN the issue is built
- THEN `sheet`, `row` and `field` are `null`

#### Scenario: Schema validation

- GIVEN an issue object with an unknown `code`
- WHEN parsed with the contracts schema
- THEN parsing fails

### Requirement: Spanish catalog in contracts

The contracts package MUST contain a Spanish catalog with a message template and a suggested action template for every issue code. Templates MUST interpolate `params`. A catalog lookup MUST be total: a test MUST fail if any code lacks an entry. The same `code` and `params` MUST always produce the same text. The API MUST NOT hard-code Spanish texts outside the catalog.

#### Scenario: Every code has an entry

- GIVEN the closed list of issue codes
- WHEN each is looked up in the catalog
- THEN every lookup returns a non-empty message and action

#### Scenario: Interpolation

- GIVEN code `DECIMAL_SCALE_EXCEEDED` with params `{ limit: 4, actual: 5 }`
- WHEN the message is rendered
- THEN the text includes both numbers

#### Scenario: No unresolved placeholders

- GIVEN each code rendered with its documented params
- WHEN the text is inspected
- THEN no `{` placeholder remains

### Requirement: Severities and counts

`error` is blocking and `warning` is not. The report MUST contain `summary.errorCount` and `summary.warningCount` computed over all issues, and `valid`, which is true if and only if `errorCount` is 0. `valid` refers to tier A only; the report MUST NOT imply that the import is ready or that Shopify checks passed.

#### Scenario: Only warnings

- GIVEN a workbook that produces only warnings
- WHEN the report is built
- THEN `valid` is true and `errorCount` is 0

#### Scenario: One error

- GIVEN a workbook with one error and two warnings
- WHEN the report is built
- THEN `valid` is false, `errorCount` is 1 and `warningCount` is 2

### Requirement: File fingerprint

The report MUST include `fileSha256`, the lowercase hexadecimal SHA-256 digest of the exact uploaded bytes, for every report including those rejected by the preflight.

#### Scenario: Known digest

- GIVEN a file whose SHA-256 is known
- WHEN it is validated
- THEN `fileSha256` equals it

#### Scenario: Rejected file

- GIVEN a macro workbook
- WHEN it is validated
- THEN `fileSha256` is still present

### Requirement: Truncation with complete counts

The number of issues in `issues` MUST be capped by a soft configurable default of 1,000. When more issues exist, `issues` MUST contain the first 1,000 ordered with errors before warnings (then by the deterministic order), `truncated` MUST be true and the summary counts MUST remain the totals of all issues. Otherwise `truncated` MUST be false.

#### Scenario: Truncated report

- GIVEN a workbook that yields 1,500 issues
- WHEN the report is built with the default cap
- THEN `issues` has 1,000 entries, `truncated` is true and the counts add up to 1,500

#### Scenario: Errors kept first

- GIVEN 600 warnings found before 600 errors
- WHEN the report is truncated at 1,000
- THEN all 600 errors are present

#### Scenario: Not truncated

- GIVEN 3 issues
- WHEN the report is built
- THEN `truncated` is false

### Requirement: Report shape for rejected files

When the file cannot be read as a workbook (preflight failure, not an XLSX, or no readable data), the report MUST still conform to the same schema, contain at least one blocking issue with `sheet` null and report no data-row issues.

#### Scenario: Not an XLSX

- GIVEN random bytes
- WHEN validated
- THEN the report parses with the contracts schema and has a blocking `FILE_NOT_XLSX`

### Requirement: Report does not leak runtime details

Issue `params` and texts MUST NOT contain absolute file-system paths, stack traces or library error text. The report MUST NOT include the file name or content beyond the specific offending cell values needed by params.

#### Scenario: Unexpected reader failure

- GIVEN the reader throws an internal error
- WHEN the workbook is validated
- THEN the report contains a generic blocking issue (`FILE_UNREADABLE`) and no error text or stack trace
