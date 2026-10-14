# Workbook Validate Endpoint

Delta spec (new capability). `POST /api/workbook/validate`. The upload transport (multipart versus raw body) is a design decision; this spec only fixes outcomes. The endpoints are stateless. The existing local request guard already covers the POST.

## ADDED Requirements

### Requirement: Request errors are ApiError 4xx

Problems with the request itself MUST be returned as the contracts `ApiError` shape with a 4xx status and MUST NOT produce a report. The contracts `ApiError.code` list MUST be extended with `WORKBOOK_FILE_REQUIRED` (400: no file, an empty file with zero bytes, or more than one file) and `WORKBOOK_TOO_LARGE` (413: upload above the limit). Existing codes (`HOST_NOT_ALLOWED`, `ORIGIN_NOT_ALLOWED`) MUST keep working unchanged.

#### Scenario: No file

- GIVEN a request without a file
- WHEN it is sent to `POST /api/workbook/validate`
- THEN the response is 400 with `ApiError` code `WORKBOOK_FILE_REQUIRED`

#### Scenario: Zero-byte file

- GIVEN a file of 0 bytes
- WHEN it is uploaded
- THEN the response is 400 with `WORKBOOK_FILE_REQUIRED`

#### Scenario: Disallowed origin

- GIVEN a request with a disallowed `Origin`
- WHEN it is sent
- THEN the response is 403 with `ORIGIN_NOT_ALLOWED` and the file is not processed

### Requirement: Upload size limit

The upload MUST be limited to a soft configurable default of 20 MB. A larger upload MUST be rejected with 413 and `WORKBOOK_TOO_LARGE`, without being fully processed.

#### Scenario: Oversize

- GIVEN a body larger than 20 MB
- WHEN it is uploaded
- THEN the response is 413 with `WORKBOOK_TOO_LARGE`

#### Scenario: Within limit

- GIVEN a valid 1 MB workbook
- WHEN it is uploaded
- THEN the response is 200

#### Scenario: Configured limit

- GIVEN the limit is configured to 1 KB
- WHEN a 2 KB file is uploaded
- THEN the response is 413

### Requirement: Content problems are 200 reports

Any problem with the file content (not an XLSX, preflight rejection, formulas, macros, external links, structure or data errors) MUST return HTTP 200 with a `ValidationReport` that conforms to the contracts schema. A file-level problem MUST appear as a blocking issue with `sheet` `null`. Content problems MUST NOT return 4xx or 5xx.

#### Scenario: Valid workbook

- GIVEN a valid workbook
- WHEN it is uploaded
- THEN the response is 200 and `valid` is true

#### Scenario: Invalid data

- GIVEN a workbook with a negative price
- WHEN it is uploaded
- THEN the response is 200 and `errorCount` is at least 1 with a `PRICE_NEGATIVE` issue

#### Scenario: Text file as workbook

- GIVEN a plain text file named `catalogo.xlsx`
- WHEN it is uploaded
- THEN the response is 200 with a blocking `FILE_NOT_XLSX` issue whose `sheet` is `null`

#### Scenario: Macro workbook

- GIVEN a package with a VBA project part
- WHEN it is uploaded
- THEN the response is 200 with a blocking `MACROS_NOT_ALLOWED` issue

### Requirement: Unexpected failures do not leak

An unexpected failure inside the reader MUST be converted to a 200 report with a generic blocking `FILE_UNREADABLE` issue, not a 500 with internal details. Failures outside the file content (for example a bug in the controller) MAY return the standard server error without internal details.

#### Scenario: Reader throws

- GIVEN a reader double that throws
- WHEN a file is uploaded
- THEN the response is 200 with `FILE_UNREADABLE` and no stack trace

### Requirement: Stateless and side-effect free

The endpoints MUST be stateless: they MUST NOT persist the upload, the report or any file hash, MUST NOT write files or database rows, MUST NOT call the network and MUST NOT call Shopify. Two requests with the same bytes MUST return equal reports. The report MUST contain the SHA-256 of the uploaded bytes.

#### Scenario: Repeatability

- GIVEN the same workbook is uploaded twice
- WHEN the two responses are compared
- THEN they are equal, including `fileSha256`

#### Scenario: No side effects

- GIVEN doubles for network, file writes and database
- WHEN a workbook is uploaded
- THEN no double is triggered

#### Scenario: Independent requests

- GIVEN an invalid workbook then a valid one
- WHEN they are uploaded in sequence
- THEN the second report contains nothing from the first

### Requirement: Limits and tier scope are honest

The report from this endpoint MUST be tier A only. The response MUST NOT claim that Shopify data (existing handles, locations, currency) was checked.

#### Scenario: Scope

- GIVEN any validated workbook
- WHEN the response is inspected
- THEN it contains no field stating Shopify checks passed and no issue whose code belongs to tier B

### Requirement: Template and validation round trip

The workbook produced by `GET /api/workbook/template` MUST be accepted by `POST /api/workbook/validate` with HTTP 200, `errorCount` 0 and only `EXAMPLE_PRODUCT` warnings.

#### Scenario: Round trip

- GIVEN a downloaded template
- WHEN it is uploaded unchanged
- THEN the response is 200, `valid` is true and every warning has code `EXAMPLE_PRODUCT`
