---
schema: gentle-ai.sdd-research/v1
change: shopify-importer-02-workbook-and-validation-core
revision: 2
outcome: done
supersedes: revision 1
accessed_at: 2026-10-14
---

# Research: shopify-importer-02-workbook-and-validation-core (S1), revision 2

## Admission

| Class | Tool | Observed | Result |
|---|---|---|---|
| documentation | WebFetch | callable | granted |
| open-web | WebSearch | callable | granted |

Method caveat: WebFetch returns a model-generated reading of each page, so excerpts are paraphrases except where quoted.

## Questions

- Q1. SheetJS CE 0.20.3 provenance, newer official releases and confirmed advisories.
- Q2. SheetJS CE read and write behavior (formulas, text versus numeric cells, macros, external links, limits, template styling).
- Q3. Shopify Admin GraphQL 2026-10 field limits relevant to tier A validation.
- Q4. Excel and OOXML facts: cell types, 15-digit precision, maximum cell text length.

## Sources

| ID | Class | Title | Publisher | URL | Excerpt |
|---|---|---|---|---|---|
| S1 | documentation | SheetJS Node.js installation | SheetJS | https://docs.sheetjs.com/docs/getting-started/installation/nodejs | The SheetJS CDN is the authoritative source; npm `xlsx` is stale at 0.18.5; vendoring is strongly recommended; Snyk reports are called false. |
| S2 | documentation | SheetJS CDN landing page | SheetJS | https://cdn.sheetjs.com/ | Lists no versions, checksums or SRI; recommends vendoring and points to a security advisories page. |
| S3 | documentation | Official repository tags | SheetJS | https://git.sheetjs.com/sheetjs/sheetjs/tags | Newest tags on page 1 of 13: v0.20.3 (2024-07-18), v0.20.2, v0.20.1, v0.20.0, v0.19.3. No v0.20.4 on page 1. |
| S4 | documentation | GHSA-4r6h-8v6p-xvw6 | GitHub Advisory Database | https://github.com/advisories/GHSA-4r6h-8v6p-xvw6 | CVE-2023-30533, prototype pollution; affects versions below 0.19.3. |
| S5 | documentation | GHSA-5pgg-2g8v-p4x9 | GitHub Advisory Database | https://github.com/advisories/GHSA-5pgg-2g8v-p4x9 | CVE-2024-22363, ReDoS; affects versions below 0.20.2. |
| S6 | documentation | Snyk, npm xlsx | Snyk | https://security.snyk.io/package/npm/xlsx | Two entries with range `*` and no fixed-in version; latest shown is 0.18.5. |
| S7 | open-web | Search results for a 0.20.4 security note | git.sheetjs.com (user fork), via WebSearch | https://git.sheetjs.com/fmoralesaliaga/sheetjs/src/branch/master/SECURITY_FIXES_0.20.4.md | Search snippet only; the raw file could not be read; not found in the official repository. |
| S8 | documentation | SheetJS parsing options | SheetJS | https://docs.sheetjs.com/docs/api/parse-options | `cellFormula`, `cellText`, `cellNF`, `cellDates`, `raw`, `bookVBA`, `sheetRows`, `dense`, `password`. |
| S9 | documentation | SheetJS formulae | SheetJS | https://docs.sheetjs.com/docs/csf/features/formulae | Formulas in `f`; array formulas keep `f` in the first cell with `F` as range and `D` for dynamic arrays; shared formulas not mentioned. |
| S10 | documentation | SheetJS cell objects | SheetJS | https://docs.sheetjs.com/docs/csf/cell | Types b, n, e, d, s, z; dates numeric unless `cellDates`; errors carry numeric `v` and error text `w`. |
| S11 | documentation | SheetJS column properties and number formats | SheetJS | https://docs.sheetjs.com/docs/csf/features/colprops | Column widths read and written for XLSX with `cellStyles: true`; number formats read only with `cellNF`; writer handling of text format not stated. |
| S12 | documentation | Shopify Admin GraphQL 2026-10 reference pages (ProductSetInput, ProductVariantSetInput, OptionSetInput, FileSetInput, Product) | Shopify | https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/ProductSetInput | Max 3 options; default 2048 variants per product; up to 20 barcodes per variant (`barcode` deprecated); handle letters, hyphens and numbers. Two pages were truncated. |
| S13 | open-web | Search results on Shopify tag and option limits | shopify.dev changelog via WebSearch | https://shopify.dev/changelog/product-tags-now-have-a-limit-of-250-per-product | Search snippet only: 250 tags per product, 255 characters per tag, 255 characters per option value. Not fetched. |
| S14 | documentation | Excel specifications and limits | Microsoft | https://support.microsoft.com/en-us/office/excel-specifications-and-limits-1672b34d-7043-467e-8e27-269d656771c3 | 32,767 characters per cell; 15 digits of number precision. |
| S15 | documentation | CellValues Enum | Microsoft Learn | https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.spreadsheet.cellvalues | Cell type values b, n, e, s, str, inlineStr, d. |

## Validated claims

- C1. The authoritative SheetJS distribution is the CDN; npm `xlsx` is stale at 0.18.5. [S1]
- C2. The docs recommend vendoring; no checksums, signatures or SRI hashes are published. [S1, S2]
- C3. The newest tag on page 1 of the official tags is v0.20.3 (2024-07-18); v0.20.4 is not on that page (only page 1 was read). [S3]
- C4. Prototype pollution CVE-2023-30533 affects versions below 0.19.3 and ReDoS CVE-2024-22363 affects versions below 0.20.2; by those ranges 0.20.3 is not affected. [S4, S5, S3]
- C5. Snyk flags both issues with range `*`; the SheetJS docs call these reports false; this does not confirm a vulnerability in 0.20.3. [S1, S6]
- C6. The 0.20.4 security note is UNCONFIRMED: it appears only as a snippet from a user fork and no official source mentions 0.20.4. [S7, S3, S5, S6]
- C7. `cellFormula` defaults to true, `cellText` to true and `cellNF` to false. [S8]
- C8. `raw` affects only HTML, CSV, PRN, DIF and RTF, not XLSX; `cellDates` defaults to false. [S8]
- C9. `bookVBA` stores the raw VBA blob in `vbaraw` without parsing; CE password support covers only XOR encryption in XLS. [S8]
- C10. Array formulas keep `f` in the first cell with `F` as range; `D` marks dynamic arrays. [S9]
- C11. Booleans are `t:"b"`; errors are `t:"e"`; dates are numeric unless `cellDates`; text cells are `t:"s"`. [S10]
- C12. Reading and writing column widths in XLSX requires `cellStyles: true`. [S11]
- C13. Number formats are read only with `cellNF`; whether a writer honors the text format is not documented. [S11]
- C14. A product has at most 3 options. [S12]
- C15. The default limit is 2048 variants per product. [S12]
- C16. A variant accepts up to 20 barcodes via `barcodes`; `barcode` is deprecated. [S12]
- C17. The handle rule is letters, hyphens and numbers, no spaces; no length is documented. [S12]
- C18. Tags: 250 per product and 255 characters each; option values: 255 characters (medium confidence, search snippets). [S13]
- C19. The pages read state no limits for title, vendor, product type, descriptionHtml, SKU, option name or value length, image alt length or the `variants` array size of `productSet`. [S12]
- C20. A cell holds at most 32,767 characters. [S14]
- C21. Excel number precision is 15 digits. [S14]
- C22. Open XML cell types: n, s, str, inlineStr, b, e, d. [S15]

## Contradictions

- SheetJS docs call Snyk's findings false while Snyk and GHSA list them without a patched npm version; reconcilable because the fixed builds are CDN-only and the fixed ranges end at 0.19.3 and 0.20.2. [S1, S4, S5, S6]
- The fork's 0.20.4 note contradicts the official tags page, which shows v0.20.3 as newest on page 1. [S3, S7]

## Rescope at revision 2 (decided by the user on 2026-10-14)

Revision 1 ended `partial`. The user decided to close research by rescoping: the questions below are limited to what documentation could answer, and every item listed under "Deferred to the spike" is moved out of research into work unit U3 (XLSX spike), to be settled by fixtures and tests, with soft configurable limits until then. No claim below depends on a deferred item.

Rescoped questions: Q1 (provenance and advisories), Q2 (documented read options and cell types only), Q3 (documented Shopify limits only), Q4 (Excel limits and cell type names).

## Deferred to the spike (excluded from claims)

- Official repository security pages and changelog; tags beyond page 1.
- SheetJS behavior on shared formulas, external links, ZIP or size limits, leading-zero text versus numeric under `cellText`, and `s` versus `inlineStr` on read.
- SheetJS CE data validation, frozen panes and writing text-formatted cells.
- Shopify limits for title, handle length, vendor, product type, SKU, single barcode length, option name, alt text, descriptionHtml size and `productSet` array size; truncated page tails were not read.
- The effect of 15-digit precision on long barcodes (the Microsoft page returned 404); only the limit itself is validated.

## Uncertainty and freshness

All sources accessed 2026-10-14. The tags page was read as of that date, page 1 only.

## Product choices (non-authoritative, not confirmed)

- Pin SheetJS 0.20.3 from the CDN tarball, vendored with a locally computed hash; do not adopt the fork's 0.20.4.
- `modern-xlsx` 1.2.1 (npm, MIT, first published 2026-03-03, one maintainer; README read on 2026-10-14) is an additional spike candidate; the README does not state formula exposure, text versus numeric cell handling, ZIP limits, macro or external-link handling, so none of these may be assumed. Source: https://registry.npmjs.org/modern-xlsx and https://github.com/ABCrimson/modern-xlsx (unvalidated readings, not part of the validated claims above).
- Treat limits Shopify does not document as configurable soft limits.
- Write barcodes and SKUs as text cells.
