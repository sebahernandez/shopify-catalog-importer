# Archive Report: shopify-importer-02-workbook-and-validation-core

**Archived on**: 2026-10-14
**Artifact store**: openspec (repo-local planning home)
**Archived to**: `openspec/changes/archive/2026-10-14-shopify-importer-02-workbook-and-validation-core/`
**Verdict at verification**: PASS WITH WARNINGS (0 critical, 0 blockers), per `verify-report.md` (evidence_revision `sha256:41d342cecbf620ea9fa118662d2d2e1f2b9bc615226b94b41fd1ccd3f5439f74`)
**Tasks at close**: 126/126 complete, 0 unchecked (`tasks.md`, read at archive time). The verify snapshot counted 123 because U11 added tasks 15.1 to 15.3 afterwards.
**Requirements**: 47/47 (per domain: workbook-contract 6, workbook-file-safety 7, workbook-validation-rules 14, validation-report 7, workbook-template 6, workbook-validate-endpoint 7)
**Scenarios**: 122/122 at verification. The promoted main specs hold 123 scenario headings, because the workbook-validate-endpoint spec gained one scenario ("Unsupported media type") during the archive-time amendments.
**Tests at close**: 3,750 (contracts 195, web 193, api 3,362), per the orchestrator launch prompt. The verify snapshot recorded 3,741 (contracts 195, web 193, api 3,353) before the post-verify corrections. These totals were not re-run during archive.
**Pull requests**: #36 to #63 (28 PRs). #35 is the S0 archive PR and is not part of S1.
**Branch**: `docs/archive-s1-workbook-validation`, from develop at 0bb42b8. `verify-report.md` names develop as its branch; the archive ran on the docs branch.

## Summary

S1 (workbook and validation core) is archived. Its six delta specs are promoted to main specs under `openspec/specs/`. The promoted text was amended to describe the shipped behaviour. The archived delta specs keep their original text, so the audit trail shows what was planned and what was promoted.

## Engram Observation IDs

None. The artifact store is openspec, so no Engram observations were read. The archive summary is saved to Engram under topic key `sdd/shopify-importer-02-workbook-and-validation-core/archive-report`.

## Sources Read

- Archived change folder (unchanged by this archive except for this report): `proposal.md`, `design.md`, `tasks.md`, `state.yaml`, `verify-report.md`, `apply-progress.md`, `spike-findings.md`, `research.md`, `exploration.md`, `specs/{workbook-contract,workbook-file-safety,workbook-validation-rules,validation-report,workbook-template,workbook-validate-endpoint}/spec.md`.
- Native status before the move (`gentle-ai sdd-status --cwd <repo> --json`): `archive: ready`, `nextRecommended: archive`, `allowedEditRoots` = the repository root.
- Code read only, to confirm shipped behaviour for the amendments: the contracts issue catalog and ApiError codes; the workbook controller, bounded body reader and exception filter; the formula guard, row reader, header resolver, workbook limits and template content. No source, package or test file was edited.
- Final-state facts from the orchestrator launch prompt: 126/126 tasks, verdict, W3, W4 and W5 fixed in unit U11, test counts, PR range.

## Final-State Authority

`verify-report.md` and `apply-progress.md` are intermediate snapshots. The following facts were taken from higher-ranked sources:

- Tasks: 126/126 complete in `tasks.md` (persisted tasks artifact), not the 123 in the verify snapshot.
- Tests: 3,750 per the launch prompt, not the 3,741 in the verify snapshot.
- W3, W4 and W5: fixed in unit U11 (tasks 15.1 to 15.3). The verify snapshot lists them as open; its "Post-verify corrections" section records the fixes, which are covered by the tests named there.
- The verify "Next step" wording is superseded: archive has been run.

## Amendments Applied to Main Specs

The main specs were copied mechanically from the delta specs first (readback below), then amended with targeted edits. The archived deltas were not amended. Counts are changed lines in `diff` between the archived delta and the main spec.

Format (all six specs), following the committed S0 main specs: title `# <Capability>` without "Delta for", heading `## Requirements` instead of `## ADDED Requirements`, and the "Delta spec (new capability)." lead-in removed from each introduction. Requirement and scenario headings keep the S0 format (`### Requirement:` and `#### Scenario:`).

### workbook-contract (12 changed lines)

1. Cell value model: a number cell's text is the shortest round-trip text of the stored number, not "its exact textual form as stored". Source: `apply-progress.md` U4 decisions (raw is the shortest round-trip of the double); `verify-report.md` W7.
2. Scenario "Numeric cell keeps its stored text": "exact text" changed to "text" for the same reason.
3. Unknown column: the warning is named `HEADER_UNKNOWN` (params sheet and header). Source: `packages/contracts` issue catalog; `resolve-headers.ts`; `verify-report.md` correctness table ("HIDDEN_CONTENT, HEADER_UNKNOWN ... not named in the delta specs").

### workbook-file-safety (18 changed lines)

4. Caps: "soft configurable default" changed to "configurable default"; the compression ratio applies to each entry above 1 MiB uncompressed, and the total cap bounds smaller entries. Source: `apply-progress.md` U3b1 decisions ("Ratio rule is per entry above 1 MiB"); `verify-report.md` W6.
5. Uncompressed size observed value is a lower bound (cap plus one byte). Source: `apply-progress.md` U3b1 ("the observed size is reported as bound plus 1").
6. Scenario "Lying declared sizes": a declared-size mismatch is `ZIP_AMBIGUOUS_ARCHIVE`, a real size above the cap is `ZIP_UNCOMPRESSED_TOO_LARGE`. Source: `verify-report.md` file-safety matrix (default cap gives ZIP_AMBIGUOUS_ARCHIVE; cap 2 gives ZIP_UNCOMPRESSED_TOO_LARGE).
7. Ambiguous and unsafe archives: duplicate names compared case-insensitively; backslash, NUL and drive-prefix names are unsafe; the ZIP_AMBIGUOUS_ARCHIVE list (ZIP64, multi-disk, two end records, comment not at end, compression methods other than stored or deflate, bad local headers, overlap, CRC and declared-size mismatch); encrypted entries give `FILE_ENCRYPTED_OR_LEGACY`. Source: `verify-report.md` file-safety matrix; `apply-progress.md` U3b1 "Finding codes".
8. Macros: part names matched case-insensitively; macro content detected by a VBA part, a macro-enabled content type or a macrosheet part. Source: `apply-progress.md` U3b2 decisions; `verify-report.md` matrix ("rejects macros by part name, content type and macrosheet").
9. Formulas: a formula in a non-data sheet (instructions or unknown sheet) is blocking with params `sheet` and `ref`; a formula seen by the archive scan but not flagged by any cell gives one file-level `FORMULA_NOT_ALLOWED`. Source: `formula-guard.ts`; `verify-report.md` W4; `apply-progress.md` U11 (W4).
10. Sheet caps: the row cap is measured on the used range (last used row minus header), so formatted blank rows count; the column cap is the used range width; the cell cap counts UTF-16 code units. Source: `apply-progress.md` U4 decisions; `verify-report.md` suggestion S5.
11. Sheet caps: `CELL_TEXT_TOO_LONG` identifies sheet and row, field null. Source: `apply-progress.md` U5b ("Accepted by the maintainer"); `verify-report.md` W2.
12. Limits are configurable: the eight `WorkbookLimits` fields (`maxUploadBytes`, `maxUncompressedBytes`, `maxEntries`, `maxRatio`, `maxRows`, `maxColumns`, `maxCellChars`, `maxReportedIssues`). Source: `workbook-limits.ts`.
13. Scenario "Long cell": sheet and row, field null.

### workbook-validation-rules (20 changed lines)

14. Structure rules: `HIDDEN_CONTENT` warning per kind and sheet (params sheet and kind), only when hidden content holds data; hidden rows and columns are detected only when the package has a styles part. Source: `read-rows.ts` (hidden kinds columnas, filas, hoja); `apply-progress.md` U4 decisions (styles part) and U5b; `verify-report.md` D11 and known-risk checklist.
15. Tag and option limits, and the alt and image count limits, are constants of the rule in this release and are not yet configurable. Source: `verify-report.md` W8; `apply-progress.md` U6b, U8a.
16. Cross-sheet rules run only when Productos, Variantes and Imagenes all resolve. Source: `apply-progress.md` U8c decisions; `verify-report.md` deviations.
17. Variant count and image count warnings: once per product. Source: `apply-progress.md` U6b and U8a.
18. Decimal prices: the four decimal codes declare no params and have fixed text. Source: `apply-progress.md` U7a decisions; `packages/contracts` catalog; `verify-report.md` W1.
19. Numeric cell text: shortest round-trip text, exponent-form numbers rejected by the decimal rules. Source: `apply-progress.md` U4 ("Exponent-form numbers"); `verify-report.md` W7.
20. Inventory: `stock` no larger than 2147483647. Source: `apply-progress.md` U2c and U7b.
21. Image rules: `variant_sku` resolution runs only when Variantes is usable; no VARIANT_SKU_UNKNOWN for an image whose product has an untrusted variant sku. Source: `verify-report.md` W3; `apply-progress.md` U11.
22. Deterministic order: sort by file, sheet order, row, column, then code; severity does not reorder unless truncated. Source: `verify-report.md` W5; `apply-progress.md` U11; the issue-collector test named there.
23. Image path reason wording: "leading slash or backslash" replaces a backticked slash token. Format and record rule only; no behaviour change.
24. Scenario "Rejected paths" example: the path /etc/passwd is written without backticks. Format and record rule only.

### validation-report (12 changed lines)

25. Issue model: `sheet` is one of the three data sheet names or null; `productKey` is set only for rows with a product key. Source: `apply-progress.md` U1b and U8c.
26. Spanish catalog: codes with no params render fixed text; the Spanish texts are a first draft pending native review; `IMAGE_PATH_INVALID` shows its reason code until each reason has a Spanish phrase. Source: `apply-progress.md` U1a ("first draft"); `verify-report.md` S1.
27. Interpolation scenario: uses `ZIP_TOO_MANY_ENTRIES` (limit 4, actual 5), since `DECIMAL_SCALE_EXCEEDED` declares no params. Source: `verify-report.md` W1; `apply-progress.md` U1a deviations.
28. Truncation: an untruncated report is not reordered by severity. Source: `verify-report.md` W5.

### workbook-template (6 changed lines)

29. Template download: response is marked `no-store`. Source: `apply-progress.md` U9b (Cache-Control no-store, harness table).

### workbook-validate-endpoint (18 changed lines)

30. Transport: a raw request body with the XLSX bytes. Accepted content types are the XLSX type, `application/octet-stream` or none; any other type, including multipart form data, is 415. Source: `workbook.controller.ts` (upload types; missing type read as octet-stream); `apply-progress.md` U10a.
31. The ApiError code list adds `WORKBOOK_UNSUPPORTED_MEDIA_TYPE` (415). Source: `packages/contracts` ApiError codes; `apply-progress.md` U1a and U1b; `verify-report.md` correctness table ("415 route").
32. The "more than one file" clause is removed (cannot occur with a raw body). Source: `verify-report.md` D6 consequence.
33. Scenario "No file" renamed "No body" (400 for no body or zero bytes).
34. New scenario "Unsupported media type" (415, body left unread). Source: `workbook.controller.ts`; `workbook-exception.filter.ts`; `apply-progress.md` U10b; `apply-progress.md` U10c harness (text/plain gives 415).
35. Upload limit: a Content-Length above the limit is answered before the body is read and the connection is closed; a streamed oversize body is drained and answered 413, never stored; a full oversize send may end in a connection error instead of 413. Source: `apply-progress.md` U10a and U10b; `verify-report.md` W10.

## Specs Synced (openspec/specs)

Created: all six domains were new. `openspec/specs/` held seven domains from S0 and was otherwise empty of these capabilities.

| Domain | Action | Requirements | Scenarios | Amended |
|--------|--------|--------------|-----------|---------|
| workbook-contract | Created | 6 ADDED | 13 | Yes (items 1 to 3) |
| workbook-file-safety | Created | 7 ADDED | 19 | Yes (items 4 to 13) |
| workbook-validation-rules | Created | 14 ADDED | 49 | Yes (items 14 to 24) |
| validation-report | Created | 7 ADDED | 15 | Yes (items 25 to 28) |
| workbook-template | Created | 6 ADDED | 10 | Yes (item 29) |
| workbook-validate-endpoint | Created | 7 ADDED | 17 (16 in the delta) | Yes (items 30 to 35) |

No destructive delta exists: there are no REMOVED or RENAMED requirements and no MODIFIED blocks. Total: 47 requirements, 123 scenario headings in the main specs.

## Move and Readbacks

Step 2 (spec copy). Each delta was copied with `cp` to its main spec path, then `diff -r` was run on each pair before any amendment. All six produced empty output with exit 0.

Step 2b (amendments). Targeted edits were made to the main specs only. Changed-line counts against the archived deltas: workbook-contract 12, workbook-file-safety 18, workbook-validation-rules 20, validation-report 12, workbook-template 6, workbook-validate-endpoint 18. Non-empty diffs are expected here and are the amendments listed above.

Step 3 (archive move). `git mv` of `openspec/changes/shopify-importer-02-workbook-and-validation-core` to `openspec/changes/archive/2026-10-14-shopify-importer-02-workbook-and-validation-core`. A pre-move snapshot was compared with the archived folder: `diff -r` output empty, exit 0. The source directory no longer exists. This report was written into the archived folder after the readback, and it is the only file added there.

Tracked and untracked state: the rename is staged by `git mv`. The new `openspec/specs/*` files and this report are untracked. No commit was made.

## Native Validator

- `gentle-ai sdd-status --cwd <repo>` before the move: `archive: ready`, `nextRecommended: archive`.
- After the move: `SDD Status: unresolved`, `No active OpenSpec changes found`, `nextRecommended: sdd-new`. This is the expected result, as after S0.
- `gentle-ai` has no spec-level validator command. The only validator command (`sdd-verify-validate`) checks verification report bytes. The promoted specs were therefore checked by heading counts (`rg`): 47 requirement headings and 123 scenario headings across the six files, in the S0 heading format.

## Accepted Limitations

These come from `verify-report.md` (at verification time) and remain open at close unless stated.

- W1: the decimal scale and magnitude codes declare no params, so their text is fixed and does not show the observed value. The interpolation check is proven with another code. Spec aligned (item 18 and 27).
- W2: `CELL_TEXT_TOO_LONG` has field null, because the reader fails before headers are resolved. Accepted by the maintainer. Spec aligned (item 11).
- W6: the ratio rule applies per entry above 1 MiB. The 150 MB inflation path is proven with a shrunken cap. Spec aligned (item 4).
- W7: a number cell is read as the shortest round-trip text of the stored double. Values with 17 or more significant digits can differ from the file text. Numbers in exponent form are rejected. Spec aligned (items 1, 19); residual remains.
- W8: tag, option-value, alt and image-count limits are constants, not configurable. Spec aligned (item 15).
- W9: remaining test gaps: (a) no route-level assertion of the ORIGIN_NOT_ALLOWED code on the validate route (status 403 is asserted); (b) no test inspects a database or upload directory for "nothing persists". Gaps (c), the no-cascade pipeline test, and (d), a formula in an ignored sheet, are covered by the U11 tests named in the post-verify corrections.
- W10: over-cap uploads sent in full may end in a connection error instead of 413. Acceptable for a loopback single-user tool. Spec aligned (item 35).
- Suggestions (verify-report S1 to S7): S1 open (Spanish catalog review and reason-code mapping, see follow-ups); S2 resolved in the specs (items 3, 14, 31, 32); S3 open (Money edge cases to document in the instructions sheet, see follow-ups); S4 open (weak guards, see follow-ups); S5 documented in the spec (item 10), behaviour unchanged; S6 open (state.yaml, see follow-ups); S7 open (test for an EJEMPLO- row with a duplicate key).
- Partial scenarios listed at verification: "Missing sheet" (cascade, W3, fixed in U11), "Long cell" (W2, spec aligned), "Nothing persists" (W9b, open), "Interpolation" (W1, spec aligned), "Disallowed origin" (W9a, open), "No side effects" (W9b, open).
- Dynamic array formulas are named in the formula requirement, but the fixture builder does not produce them (`apply-progress.md` U3c). No test covers that case.

## Carried-Over Follow-Ups

1. Native-speaker review of the Spanish catalog (S1). The catalog is a first draft.
2. Message text for the formula location: `FORMULA_NOT_ALLOWED` in an ignored sheet carries params `sheet` and `ref`, but the message text does not show them.
3. Map the six `IMAGE_PATH_INVALID` reason codes to Spanish phrases. The message text currently shows the raw code.
4. Make the soft limits configurable: 250 tags, 255 characters per tag, 255 characters per option value, 512 characters for alt, 250 images and 250 variant rows. `WorkbookLimits` already covers the eight other caps.
5. `state.yaml` phases are stale: apply, verify and archive still read pending. The file is orchestrator-owned, and the S0 archive left it unchanged too, so it was not edited here.
6. Document the Money edge cases in the instructions sheet (S3): space thousands separators are DECIMAL_INVALID, ".5" and "5." are rejected, "-0" and "0.0000" are zero with PRICE_ZERO.
7. Replace the weak guards (S4): the contracts neutrality test matches only the `node:` import prefix, and the image-path purity test cannot fail because the module imports no file-system API.
8. Consider counting populated rows for the row cap, not the used range (S5).
9. Add a test for an EJEMPLO- row with a duplicate product key (S7).
10. Add a fixture for dynamic array formulas.
11. Add the route-level ORIGIN_NOT_ALLOWED code assertion (W9a) and a database or upload-directory inspection test for "nothing persists" (W9b).
12. Known residual: the over-cap connection race (W10).

## Known Differences From the S0 Archive Record

- The S0 archive report says main specs were copied verbatim. The committed S0 main specs carry the header change described above, so this archive follows the committed format.
- The S0 archive amended its delta specs in place. For S1, the instruction was to keep the delta specs as they were, so the amendments live only in the main specs.

## Final State

The change is archived. Native status for the change no longer resolves, because no active change remains under `openspec/changes/`. Verification found no CRITICAL issues. All 126 tasks are complete. The promoted specs reflect the shipped behaviour as documented by the verification report, apply-progress and the code paths listed above. The accepted limitations and follow-ups above remain open.
