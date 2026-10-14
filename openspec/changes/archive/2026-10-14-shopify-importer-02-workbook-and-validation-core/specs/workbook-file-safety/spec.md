# Workbook File Safety

Delta spec (new capability). Defence of the importer against hostile or unsupported XLSX files. All checks run on the uploaded bytes in memory, before any XLSX library sees them, and MUST NOT depend on which library or adapter is chosen. Every cap is a soft, configurable default, not a hard product rule.

## ADDED Requirements

### Requirement: ZIP preflight runs before parsing

The system MUST inspect the ZIP structure of every uploaded file before the `WorkbookReader` port is invoked. If any preflight check fails, the reader MUST NOT be called and the result MUST be a report with blocking issues whose `sheet` is `null`.

#### Scenario: Reader is not called on a rejected archive

- GIVEN a workbook archive that fails any preflight check
- WHEN it is validated with a spy `WorkbookReader`
- THEN the spy is never called and the report has at least one blocking issue with `sheet` null

#### Scenario: Not an XLSX package

- GIVEN bytes that are not a ZIP archive, or a ZIP without the workbook part
- WHEN it is validated
- THEN the report has a blocking `FILE_NOT_XLSX` issue and the HTTP status is 200

### Requirement: Configurable archive caps

The preflight MUST enforce these caps, each a soft configurable default: at most 200 entries, at most 150 MB total uncompressed, and an overall compression ratio of at most 100:1. Exceeding a cap MUST produce a blocking issue (`ZIP_TOO_MANY_ENTRIES`, `ZIP_UNCOMPRESSED_TOO_LARGE`, `ZIP_RATIO_EXCEEDED`) whose params carry the limit and the observed value. Sizes MUST be measured by bounded real decompression and MUST NOT trust sizes declared in the archive; decompression MUST stop once the cap is exceeded.

#### Scenario: Too many entries

- GIVEN an archive with 201 entries and default configuration
- WHEN it is preflighted
- THEN a blocking `ZIP_TOO_MANY_ENTRIES` issue has params limit 200 and actual 201

#### Scenario: Decompression bomb

- GIVEN a small archive that inflates beyond 150 MB or beyond ratio 100:1
- WHEN it is preflighted
- THEN the matching blocking issue is reported and inflation stops once the limit is crossed

#### Scenario: Lying declared sizes

- GIVEN an archive whose headers declare small sizes but whose data inflates beyond the cap
- WHEN it is preflighted
- THEN it is rejected based on the real inflated size

#### Scenario: Cap override

- GIVEN configuration sets the entry cap to 10
- WHEN an archive with 11 entries is preflighted
- THEN it is rejected with limit 10

### Requirement: Ambiguous and unsafe archives are rejected

The preflight MUST reject archives with duplicate entry names, entry names that are absolute or contain `..` path traversal, and overlapping or otherwise inconsistent entries, because they can be read differently by different parsers. Each MUST be a blocking issue (`ZIP_UNSAFE_ENTRY_NAME`, `ZIP_AMBIGUOUS_ARCHIVE`).

#### Scenario: Traversal name

- GIVEN an entry named `../evil.xml`
- WHEN it is preflighted
- THEN a blocking `ZIP_UNSAFE_ENTRY_NAME` issue is reported

#### Scenario: Duplicate entry

- GIVEN two entries named `xl/workbook.xml`
- WHEN it is preflighted
- THEN a blocking `ZIP_AMBIGUOUS_ARCHIVE` issue is reported

### Requirement: Macros, external links and embedded content are blocking

A workbook that contains macro content (a VBA project part or a macro-enabled content type), external link parts, embedded objects or ActiveX parts MUST be rejected with blocking issues `MACROS_NOT_ALLOWED`, `EXTERNAL_LINKS_NOT_ALLOWED` or `EMBEDDED_CONTENT_NOT_ALLOWED`, with `sheet` null. This MUST NOT depend on a file extension, only on package content.

#### Scenario: Macro workbook

- GIVEN a package containing `xl/vbaProject.bin`
- WHEN it is validated
- THEN the report has a blocking `MACROS_NOT_ALLOWED` issue and the reader is not called

#### Scenario: External link

- GIVEN a package containing `xl/externalLinks/externalLink1.xml`
- WHEN it is validated
- THEN the report has a blocking `EXTERNAL_LINKS_NOT_ALLOWED` issue

#### Scenario: Renamed extension

- GIVEN a macro-enabled package uploaded with the name `catalogo.xlsx`
- WHEN it is validated
- THEN it is still rejected as containing macros

### Requirement: Formulas are blocking

Any cell that holds a formula, whether plain, shared, array, dynamic or with a text result, MUST produce a blocking `FORMULA_NOT_ALLOWED` issue identifying sheet, original row and column. Detection MUST NOT rely only on the chosen reader surfacing formulas. Rules for a formula cell MUST be skipped (its value is not trusted); other cells are still validated.

#### Scenario: Plain formula

- GIVEN Variantes cell `precio` in row 3 contains `=A1*2`
- WHEN the workbook is validated
- THEN a blocking `FORMULA_NOT_ALLOWED` issue has sheet `Variantes`, row 3, field `precio`

#### Scenario: Shared formula

- GIVEN several cells share one shared formula definition
- WHEN the workbook is validated
- THEN each affected cell is reported

#### Scenario: Formula with text result

- GIVEN a formula cell whose cached result is the text `abc`
- WHEN the workbook is validated
- THEN it is still reported as a formula

### Requirement: Sheet size caps

The system MUST enforce these soft configurable caps: at most 50,000 data rows per sheet, at most 64 columns per sheet and at most 32,767 characters per cell. Exceeding one MUST produce a blocking issue (`SHEET_ROW_LIMIT_EXCEEDED`, `SHEET_COLUMN_LIMIT_EXCEEDED`, `CELL_TEXT_TOO_LONG`) with limit and observed value in params; the cell cap issue MUST identify sheet, row and field.

#### Scenario: Too many rows

- GIVEN a sheet with 50,001 data rows and default configuration
- WHEN it is validated
- THEN a blocking `SHEET_ROW_LIMIT_EXCEEDED` issue names the sheet with limit 50000

#### Scenario: Too many columns

- GIVEN a sheet with 65 header cells
- WHEN it is validated
- THEN a blocking `SHEET_COLUMN_LIMIT_EXCEEDED` issue is reported

#### Scenario: Long cell

- GIVEN a cell of 32,768 characters
- WHEN it is validated
- THEN a blocking `CELL_TEXT_TOO_LONG` issue gives sheet, row and field

### Requirement: No network and no writes

Validating a workbook MUST NOT perform any network call and MUST NOT write to the file system, the database or any other store. The uploaded bytes MUST be processed in memory only and discarded after the response.

#### Scenario: Validation is side-effect free

- GIVEN test doubles that fail on any network or file-system write
- WHEN a valid and an invalid workbook are validated
- THEN no double is triggered

#### Scenario: Nothing persists

- GIVEN a workbook was validated
- WHEN the database and upload directories are inspected
- THEN they hold no trace of the file
