# Workbook Contract

Defines the sheets and columns of the catalog workbook and how names are matched. The constants live in the contracts package as the single source of truth; the requirements document sections 5 to 7 are the origin. Decisions: 7a, D6, D7.

## Requirements

### Requirement: Sheet and column constants

The contracts package MUST export constants for the workbook schema: the three data sheets `Productos`, `Variantes`, `Imagenes`, the optional instructions sheet `Instrucciones`, and the ordered column list of each data sheet. Productos: `product_key`, `handle`, `titulo`, `descripcion_html`, `marca`, `tipo`, `etiquetas`. Variantes: `product_key`, `sku`, `precio`, `precio_comparacion`, `codigo_barras`, `opcion1_nombre`, `opcion1_valor`, `opcion2_nombre`, `opcion2_valor`, `opcion3_nombre`, `opcion3_valor`, `gestionar_inventario`, `stock`, `ubicacion`. Imagenes: `product_key`, `archivo`, `orden`, `alt`, `variant_sku`. The constants MUST be importable without any Node built-in module. Each column MUST be declared as required or optional; `product_key`, `handle`, `titulo` (Productos), `product_key`, `precio` (Variantes) and `product_key`, `archivo`, `orden` (Imagenes) are required.

#### Scenario: Constants are exposed

- GIVEN the contracts package
- WHEN a consumer imports the workbook schema constants
- THEN the three sheet names and every column listed above are present, in that order

#### Scenario: Contracts stay runtime-neutral

- GIVEN the contracts package source
- WHEN its imports are inspected
- THEN no Node built-in module is imported by the workbook schema

### Requirement: Accent-insensitive, case-insensitive name matching

Sheet names and column headers MUST be matched after trimming surrounding whitespace, case-folding and removing diacritics. A sheet named `Imágenes` MUST match `Imagenes`. Matching MUST NOT depend on sheet order or column order. Issues MUST refer to the canonical name from the constants, not to the text written in the file.

#### Scenario: Accented sheet name

- GIVEN a workbook whose third sheet is named `  Imágenes `
- WHEN sheet names are resolved
- THEN it is resolved as `Imagenes`

#### Scenario: Header case, accents and order

- GIVEN a Productos header row `TITULO`, `Handle`, ` product_key `, in that order
- WHEN headers are resolved
- THEN each maps to `titulo`, `handle`, `product_key` regardless of position

#### Scenario: Ambiguous names after normalization

- GIVEN two sheets named `Imagenes` and `imágenes`
- WHEN sheet names are resolved
- THEN the workbook is reported as having a duplicate sheet and neither is silently chosen

### Requirement: Header row and original row numbers

The first row of each data sheet MUST be the header row. Data rows start at row 2. Every row reference in an issue MUST be the original 1-based spreadsheet row number, never an index into a filtered list. Rows whose cells are all empty or whitespace-only MUST be ignored (including rows that only carry formatting) and MUST NOT shift the numbering of later rows.

#### Scenario: Blank rows keep numbering

- GIVEN Productos rows 2 and 4 hold data and row 3 is blank
- WHEN row 4 has an error
- THEN the issue refers to row 4

#### Scenario: Whitespace-only row

- GIVEN a row whose cells contain only spaces
- WHEN the sheet is read
- THEN the row is ignored and produces no issue

### Requirement: Optional instructions sheet and unknown columns

The instructions sheet MUST be optional and its content MUST NOT be validated or imported. Extra sheets with unrecognized names MUST be ignored. An unrecognized column in a data sheet MUST NOT block validation and MUST produce a non-blocking `HEADER_UNKNOWN` warning (params sheet and header); its content MUST be ignored.

#### Scenario: Instructions sheet ignored

- GIVEN a workbook with `Instrucciones` containing arbitrary text
- WHEN it is validated
- THEN that sheet raises no issue

#### Scenario: Unknown column

- GIVEN Variantes has an extra header `notas`
- WHEN the workbook is validated
- THEN a `HEADER_UNKNOWN` warning names the sheet and the unknown header and no error results from it

### Requirement: Cell value model

The domain MUST receive cells through a model that distinguishes empty, text, number (with its text as the reader provides it: the shortest round-trip text of the stored number), boolean, error and date kinds, so that rules can tell a numeric cell from a text cell. Text values MUST be trimmed before rules apply; a whitespace-only text MUST be treated as empty. Rules MUST NOT depend on any XLSX library type.

#### Scenario: Numeric cell keeps its stored text

- GIVEN a number cell stored as `19.9`
- WHEN it is mapped to the cell model
- THEN its kind is number and its text is `19.9`

#### Scenario: Whitespace-only text

- GIVEN a text cell containing `"   "`
- WHEN it is mapped to the cell model
- THEN it is treated as empty

### Requirement: One barcode and comma tags (D6, D7)

The contract MUST define `codigo_barras` as exactly one barcode per variant and `etiquetas` as one comma-delimited list of tags. A tag list MUST be normalized by trimming each tag, dropping empty items and removing duplicates (case-insensitively, keeping the first spelling and order).

#### Scenario: Tag normalization

- GIVEN `etiquetas` is ` verano, Verano ,, oferta `
- WHEN tags are parsed
- THEN the result is `verano`, `oferta`

#### Scenario: Empty tag list

- GIVEN `etiquetas` is empty
- WHEN tags are parsed
- THEN the result is an empty list and no issue is raised
