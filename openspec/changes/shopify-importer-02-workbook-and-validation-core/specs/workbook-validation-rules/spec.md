# Workbook Validation Rules

Delta spec (new capability). Tier A (local, file-only) rules. Nothing here consults Shopify: existing handles, locations and currency scale are tier B and out of scope. Severity is `error` (blocking) or `warning`. Rules run on the domain cell model, so every scenario is testable with an in-memory fake reader. Decisions: 2a to 6a, 8a, 10a, 11a, D6, D7.

## ADDED Requirements

### Requirement: Structure rules

The validator MUST report a blocking `SHEET_MISSING` for each missing data sheet, `SHEET_DUPLICATE` for sheets that collide after name normalization, `HEADER_MISSING` for each missing required column, and `HEADER_DUPLICATE` for a column that appears more than once after normalization. A missing optional column MUST NOT raise an issue and its values MUST be treated as empty. When a sheet or required column is missing, rules that need it MUST be skipped and MUST NOT cascade into per-row errors.

#### Scenario: Missing sheet

- GIVEN a workbook without `Variantes`
- WHEN it is validated
- THEN one blocking `SHEET_MISSING` issue names `Variantes` and no row-level Variantes issue appears

#### Scenario: Missing required column

- GIVEN Productos has no `handle` header
- WHEN it is validated
- THEN a blocking `HEADER_MISSING` issue names `handle`

#### Scenario: Duplicate header

- GIVEN Variantes has `SKU` and `sku` headers
- WHEN it is validated
- THEN a blocking `HEADER_DUPLICATE` issue is reported

#### Scenario: Missing optional column

- GIVEN Productos has no `marca` header
- WHEN it is validated
- THEN no issue concerns `marca`

### Requirement: Productos required fields and keys

Each Productos row MUST have non-empty `product_key`, `handle` and `titulo`; a missing value MUST be a blocking `REQUIRED_FIELD_MISSING` with the field name. A repeated `product_key` MUST be a blocking `PRODUCT_KEY_DUPLICATE` referring to the first row. A repeated `handle` (compared case-insensitively) MUST be a blocking `HANDLE_DUPLICATE`. A `handle` MUST contain only ASCII letters, digits and hyphens, with no spaces; otherwise it is a blocking `HANDLE_INVALID_FORMAT`. These rules check the file only; whether a handle already exists in Shopify is out of scope (D7).

#### Scenario: Missing title

- GIVEN a Productos row 5 with an empty `titulo`
- WHEN it is validated
- THEN a blocking `REQUIRED_FIELD_MISSING` has sheet `Productos`, row 5, field `titulo`

#### Scenario: Duplicate key and handle

- GIVEN rows 2 and 3 share `product_key` `A1`, and rows 2 and 4 share handle `Camisa`/`camisa`
- WHEN it is validated
- THEN `PRODUCT_KEY_DUPLICATE` is reported on row 3 and `HANDLE_DUPLICATE` on row 4

#### Scenario: Invalid handle

- GIVEN a handle `camisa roja`
- WHEN it is validated
- THEN a blocking `HANDLE_INVALID_FORMAT` is reported

#### Scenario: Valid handle

- GIVEN the handle `camisa-roja-2`
- WHEN it is validated
- THEN no handle issue appears

### Requirement: Example products warn without blocking

A Productos row whose `product_key` begins with `EJEMPLO-` (trimmed, case-insensitive) MUST produce one non-blocking `EXAMPLE_PRODUCT` warning. All other rules MUST still apply to it, and the warning alone MUST NOT make the report blocking.

#### Scenario: Example row

- GIVEN a valid product with key `EJEMPLO-REMERA`
- WHEN the workbook is validated
- THEN there is exactly one `EXAMPLE_PRODUCT` warning for it and zero errors

#### Scenario: Example row with a defect

- GIVEN `EJEMPLO-REMERA` has an empty `titulo`
- WHEN the workbook is validated
- THEN the `REQUIRED_FIELD_MISSING` error is reported in addition to the warning

### Requirement: Tag and text field checks

`etiquetas` MUST be parsed as comma tags (D7) with trimming and de-duplication. More than 250 tags in one product, or a tag longer than 255 characters, MUST produce a non-blocking `TAG_LIMIT_EXCEEDED` warning. Both limits are soft, configurable defaults.

#### Scenario: Tag too long

- GIVEN a tag of 256 characters
- WHEN it is validated
- THEN a `TAG_LIMIT_EXCEEDED` warning is reported and no error

#### Scenario: Duplicated tags

- GIVEN `etiquetas` is `a, A, b`
- WHEN it is validated
- THEN no issue appears

### Requirement: Cross-sheet references

Every Variantes and Imagenes row MUST have a non-empty `product_key` that exists in Productos; otherwise a blocking `PRODUCT_KEY_UNKNOWN` MUST be reported on that row. A Productos row without any Variantes row MUST produce a blocking `PRODUCT_WITHOUT_VARIANTS`.

#### Scenario: Orphan variant

- GIVEN a Variantes row 7 with key `ZZ` absent from Productos
- WHEN it is validated
- THEN a blocking `PRODUCT_KEY_UNKNOWN` is reported at row 7

#### Scenario: Product without variants

- GIVEN a Productos row with no Variantes rows
- WHEN it is validated
- THEN a blocking `PRODUCT_WITHOUT_VARIANTS` is reported for it

### Requirement: Variant structure and options

A product with exactly one Variantes row and all option fields empty is a simple product and is valid. A product with two or more variant rows MUST have at least one named option, and every variant row of that product MUST use the same option names in the same positions (`opcion1_nombre` to `opcion3_nombre`, compared case-insensitively); otherwise a blocking `OPTIONS_INCONSISTENT` is reported. An option name without value, or a value without name, MUST be a blocking `OPTION_INCOMPLETE`. Two variants of one product with the same ordered option values (trimmed, case-insensitive) MUST be a blocking `OPTION_COMBINATION_DUPLICATE`. A product with more than 250 variant rows MUST produce a non-blocking `VARIANT_COUNT_HIGH` warning, and an option value longer than 255 characters a `OPTION_VALUE_TOO_LONG` warning; both are soft, configurable limits.

#### Scenario: Simple product

- GIVEN one Variantes row for a product with empty option fields
- WHEN it is validated
- THEN no option issue appears

#### Scenario: Multi-variant without options

- GIVEN two rows for one product, both with empty options
- WHEN it is validated
- THEN a blocking `OPTIONS_INCONSISTENT` is reported

#### Scenario: Different option names between rows

- GIVEN row 2 uses `Talla` and row 3 uses `Color` as `opcion1_nombre` for the same product
- WHEN it is validated
- THEN a blocking `OPTIONS_INCONSISTENT` is reported at row 3

#### Scenario: Repeated combination

- GIVEN two rows of one product both with `Talla`=`M`
- WHEN it is validated
- THEN a blocking `OPTION_COMBINATION_DUPLICATE` is reported on the second row

#### Scenario: Name without value

- GIVEN `opcion1_nombre` is `Talla` and `opcion1_valor` is empty
- WHEN it is validated
- THEN a blocking `OPTION_INCOMPLETE` is reported

### Requirement: SKU policy

`sku` is optional. An empty `sku` MUST be a non-blocking `SKU_MISSING` warning. A `sku` repeated among the variants of the same product MUST be a blocking `SKU_DUPLICATE_IN_PRODUCT`. A `sku` repeated across different products MUST be a non-blocking `SKU_DUPLICATE_ACROSS_PRODUCTS` warning. SKUs are compared after trimming, as text.

#### Scenario: Blank SKU

- GIVEN a variant with empty `sku`
- WHEN it is validated
- THEN a `SKU_MISSING` warning is reported and no error

#### Scenario: Duplicate in same product

- GIVEN two variants of one product with `sku` `A-1`
- WHEN it is validated
- THEN a blocking `SKU_DUPLICATE_IN_PRODUCT` is reported

#### Scenario: Duplicate across products

- GIVEN two variants of different products with `sku` `A-1`
- WHEN it is validated
- THEN a `SKU_DUPLICATE_ACROSS_PRODUCTS` warning is reported and no error

### Requirement: Decimal prices through Money

`precio` and `precio_comparacion` MUST be parsed with the existing `Money` value object, never with floating point. A numeric cell MUST be read from its exact stored text. `precio` is required; empty is a blocking `REQUIRED_FIELD_MISSING`. A value `Money` rejects MUST be blocking: `DECIMAL_AMBIGUOUS` for comma or thousands separators, `DECIMAL_INVALID` for other malformed text including exponent form. More than 4 decimal places MUST be a blocking `DECIMAL_SCALE_EXCEEDED`; a magnitude of 1e12 or more MUST be a blocking `DECIMAL_MAGNITUDE_EXCEEDED`. A negative amount MUST be a blocking `PRICE_NEGATIVE`. A zero `precio` MUST be a non-blocking `PRICE_ZERO` warning. `precio_comparacion` is optional; when present and lower than `precio`, a non-blocking `COMPARE_AT_BELOW_PRICE` warning MUST be reported. The currency scale of the store is not checked (tier B).

#### Scenario: Valid price

- GIVEN `precio` text `1999.9999`
- WHEN it is validated
- THEN no price issue appears

#### Scenario: Comma decimal

- GIVEN `precio` is `19,99`
- WHEN it is validated
- THEN a blocking `DECIMAL_AMBIGUOUS` is reported

#### Scenario: Too many decimals and too large

- GIVEN `precio` values `1.12345` and `1000000000000`
- WHEN they are validated
- THEN `DECIMAL_SCALE_EXCEEDED` and `DECIMAL_MAGNITUDE_EXCEEDED` are reported respectively

#### Scenario: Negative and zero

- GIVEN `precio` values `-1` and `0`
- WHEN they are validated
- THEN `-1` is a blocking `PRICE_NEGATIVE` and `0` is a `PRICE_ZERO` warning

#### Scenario: Compare-at below price

- GIVEN `precio` `10` and `precio_comparacion` `8`
- WHEN it is validated
- THEN a `COMPARE_AT_BELOW_PRICE` warning is reported and no error

#### Scenario: Numeric price cell

- GIVEN a numeric cell with stored text `0.1`
- WHEN it is validated
- THEN it is parsed as exactly `0.1`

### Requirement: Barcode and numeric identifier cells

`codigo_barras` MUST hold one barcode (D6): a value containing a comma, semicolon, pipe, line break or inner whitespace MUST be a blocking `BARCODE_MULTIPLE`. When `sku` or `codigo_barras` is stored as a number cell, a warning `NUMERIC_IDENTIFIER_CELL` MUST be reported if its integer text has at most 15 digits (leading zeros may have been lost); a blocking `NUMERIC_IDENTIFIER_UNSAFE` MUST be reported if it has 16 or more digits or is in exponent form. Text cells are never subject to this rule.

#### Scenario: Multiple barcodes

- GIVEN `codigo_barras` text `7501,7502`
- WHEN it is validated
- THEN a blocking `BARCODE_MULTIPLE` is reported

#### Scenario: Short numeric identifier

- GIVEN `sku` is a number cell `12345`
- WHEN it is validated
- THEN a `NUMERIC_IDENTIFIER_CELL` warning is reported and no error

#### Scenario: Long or exponent numeric identifier

- GIVEN `codigo_barras` is a number cell `1234567890123456` and another is `1.23457E+15`
- WHEN they are validated
- THEN each yields a blocking `NUMERIC_IDENTIFIER_UNSAFE`

#### Scenario: Leading zeros as text

- GIVEN `sku` is the text cell `00123`
- WHEN it is validated
- THEN no identifier issue appears

### Requirement: Inventory and location

`gestionar_inventario` MUST accept `true`/`false`, `verdadero`/`falso`, `si`/`sí`/`no`, `1`/`0` and native boolean cells, compared trimmed, case-insensitive and accent-insensitive; any other value MUST be a blocking `BOOLEAN_INVALID`. An empty value MUST be treated as false when `stock` is also empty, and MUST be a blocking `INVENTORY_FLAG_REQUIRED` when `stock` is present. `stock` MUST be a non-negative integer (absolute quantity); otherwise a blocking `STOCK_INVALID`. When inventory is managed, `stock` MUST be present (`STOCK_INVALID` if empty) and `ubicacion` MUST be non-empty (blocking `REQUIRED_FIELD_MISSING`). `ubicacion` holds exactly one location name per variant row; it is never resolved against Shopify here.

#### Scenario: Boolean spellings

- GIVEN `gestionar_inventario` values `Sí`, `SI`, `no`, `Verdadero`, `FALSO`, `1`, `0` and a native true
- WHEN they are validated
- THEN all are accepted with the matching boolean value

#### Scenario: Invalid spelling

- GIVEN the value `quizás`
- WHEN it is validated
- THEN a blocking `BOOLEAN_INVALID` is reported

#### Scenario: Blank flag

- GIVEN the flag is empty and `stock` is `5`
- WHEN it is validated
- THEN a blocking `INVENTORY_FLAG_REQUIRED` is reported
- AND with `stock` also empty the flag is false and no issue appears

#### Scenario: Stock values

- GIVEN `stock` values `3`, `-1`, `2.5`, `abc`
- WHEN they are validated with the flag true and a location
- THEN `3` is accepted and the other three are blocking `STOCK_INVALID`

#### Scenario: Managed without location

- GIVEN the flag is true, `stock` is `3` and `ubicacion` is empty
- WHEN it is validated
- THEN a blocking `REQUIRED_FIELD_MISSING` names `ubicacion`

### Requirement: Image rules

Each Imagenes row MUST have `archivo` and `orden`. `archivo` MUST pass the pure image path syntax check (below); `orden` MUST be a positive integer (empty or invalid is a blocking `IMAGE_ORDER_INVALID`). Two images of one product with the same `orden` MUST be a blocking `IMAGE_ORDER_DUPLICATE`. Gaps in `orden` are allowed. The image with the lowest `orden` of a product is its cover, independent of row order. `alt` longer than a soft configurable default of 512 characters MUST be a non-blocking `ALT_TOO_LONG` warning, and a product with more than 250 images a `IMAGE_COUNT_HIGH` warning. `variant_sku`, when present, MUST match exactly one variant `sku` of the same product; zero matches is a blocking `VARIANT_SKU_UNKNOWN`, more than one a blocking `VARIANT_SKU_AMBIGUOUS`. Existence of the image file is not checked here.

#### Scenario: Order required

- GIVEN an image row with empty `orden`
- WHEN it is validated
- THEN a blocking `IMAGE_ORDER_INVALID` is reported

#### Scenario: Order values

- GIVEN `orden` values `0`, `-1`, `1.5`, `2`
- WHEN they are validated
- THEN the first three are blocking `IMAGE_ORDER_INVALID` and `2` is accepted

#### Scenario: Duplicate order

- GIVEN two images of one product both with `orden` 1
- WHEN they are validated
- THEN a blocking `IMAGE_ORDER_DUPLICATE` is reported on the second

#### Scenario: Cover is the lowest order

- GIVEN a product with images ordered 3, 1, 2 in rows
- WHEN the parsed model is read
- THEN the image with `orden` 1 is the cover

#### Scenario: Variant SKU resolution

- GIVEN `variant_sku` `B-2` where the product has no such SKU, and another that matches one variant
- WHEN they are validated
- THEN the first is a blocking `VARIANT_SKU_UNKNOWN` and the second is accepted

### Requirement: Image path syntax check

The system MUST provide a pure function, reusable by later slices, that validates `archivo` without any file-system access. A path MUST be rejected with a reason code (`IMAGE_PATH_EMPTY`, `IMAGE_PATH_ABSOLUTE`, `IMAGE_PATH_TRAVERSAL`, `IMAGE_PATH_URL`, `IMAGE_PATH_CONTROL_CHARS`, `IMAGE_PATH_NO_FILENAME`) when it is empty, absolute (leading `/`, `\`, a drive letter or a UNC prefix), contains a `..` segment, has a URL scheme, contains control characters, or ends with a separator. Backslash and slash are both separators for these checks. A relative path with sub-folders MUST be accepted. The row-level issue MUST be a blocking `IMAGE_PATH_INVALID` with the reason in params.

#### Scenario: Accepted paths

- GIVEN `fotos/camisa 1.jpg` and `camisa.png`
- WHEN checked
- THEN both are accepted

#### Scenario: Rejected paths

- GIVEN `/etc/passwd`, `C:\a.jpg`, `..\\x.jpg`, `https://x.test/a.jpg`, `fotos/`
- WHEN checked
- THEN each is rejected with its respective reason code

#### Scenario: Purity

- GIVEN the function is called on a path that exists on disk
- WHEN it runs under a file-system spy
- THEN the spy records no access

### Requirement: Other cell kinds

An error-valued cell (for example `#N/A`) in a field a rule reads MUST be a blocking `CELL_ERROR_VALUE`. A date cell in a text or numeric field MUST be a blocking `CELL_TYPE_UNEXPECTED`. A boolean cell is only valid in `gestionar_inventario`.

#### Scenario: Error cell

- GIVEN `precio` holds an error cell
- WHEN it is validated
- THEN a blocking `CELL_ERROR_VALUE` is reported

#### Scenario: Date cell

- GIVEN `stock` holds a date cell
- WHEN it is validated
- THEN a blocking `CELL_TYPE_UNEXPECTED` is reported

### Requirement: Rule evaluation is deterministic and complete

Validation MUST collect all issues in one pass rather than stopping at the first error, and issue order MUST be deterministic (file-level, then sheet order Productos, Variantes, Imagenes, then row, then column order). The same input MUST yield the same issues.

#### Scenario: Several defects

- GIVEN a workbook with three independent defects in different sheets
- WHEN it is validated
- THEN all three are reported in sheet then row order

#### Scenario: Repeat run

- GIVEN the same workbook is validated twice
- WHEN the issue lists are compared
- THEN they are identical
