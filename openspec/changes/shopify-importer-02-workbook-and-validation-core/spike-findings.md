# Spike findings: XLSX library (U3c, decision D4)

Date: 2026-10-14. Branch: feat/workbook-u3c-library-spike. Node 24, pnpm 12.11.2, Vitest 5.0.4.

## Outcome

**Chosen: SheetJS CE 0.20.3**, vendored. `modern-xlsx` 1.2.1 was not probed (the protocol stops at the first candidate that passes every must-pass criterion) and fallback B is not needed.

| Item | Value |
|---|---|
| Source | https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz, downloaded once into an empty scratch directory outside the repository, never executed |
| SHA-256 (computed locally) | `8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8` |
| pnpm lockfile integrity | `sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==` (entry `xlsx@file:vendor/sheetjs/xlsx-0.20.3.tgz`) |
| Vendored files | `vendor/sheetjs/xlsx-0.20.3.tgz`, `vendor/sheetjs/xlsx-0.20.3.tgz.sha256`, `vendor/sheetjs/LICENSE` (Apache-2.0, taken from the package) |
| Dependency | `"xlsx": "file:../../vendor/sheetjs/xlsx-0.20.3.tgz"` in `apps/api/package.json` (no CDN URL anywhere) |
| Manifest inspected before install | license Apache-2.0; no `preinstall`, `install` or `postinstall` script (only test, build and lint scripts that pnpm never runs on install); `dependencies` is empty; `hasBin: true` (a CLI file, not run) |

## Candidate by criterion

| Criterion | SheetJS CE 0.20.3 | modern-xlsx 1.2.1 | Evidence (probe test) |
|---|---|---|---|
| E1 formulas flagged with coordinates (should) | PASS: plain, shared master, shared dependent (formula text shifted to the dependent), array, text-result formula all carry `f` at their cell address; non-formula cells have none. Dynamic array formulas are NOT covered: the fixture builder cannot emit the `cm` attribute | not probed | `E1: formula cells are flagged with their coordinates, plain and dependent shared included` |
| E2 leading-zero text in `s`, `str`, `inlineStr` (must) | PASS: `0123` comes back as type `s`, value `0123`, for all three storage forms; whitespace-only shared string preserved | not probed | `E2: leading-zero text survives unmodified in s, str and inlineStr` |
| E3 numeric identifiable, decimal text recoverable (must) | PASS with a documented limit: numeric cells are type `n` with a JS double; `String(v)` gives the shortest round-trip (`0.30000000000000004`, `1.1`). The lexical `<v>` is NOT exposed (`10.50` becomes `10.5`) | not probed | `E3: numeric cells are numbers whose shortest decimal text is recoverable` |
| E4 boolean, error, `t="d"`, rich text, whitespace-only (must) | PASS: `b` true; `e` with error text in `w`; `d` as a `Date` (needs `cellDates: true`); rich text joined unmodified; whitespace-only and empty inline text preserved | not probed | `E4: booleans, errors, dates, rich text and whitespace-only cells stay distinguishable` |
| E5 hidden sheet, row, column flags (must) | PASS: workbook sheet `Hidden` 0 or 1; row `hidden` in `!rows`; column `hidden` in `!cols`. Row and column flags need `cellStyles: true` (without it both are null) | not probed | `E5: hidden sheet, row and column flags are reported` |
| E6 original 1-based rows survive gaps (must) | PASS: cells keep their addresses, so row numbers come from `decode_cell`; `!ref` spans the gap; skipped rows have no cells | not probed | `E6: original 1-based rows survive gaps` |
| E7 ESM, no network, fs, eval, install scripts, license (must) | PASS: `xlsx.mjs` imports fine under Node 24 and Vitest; it contains no import statement, `eval`, `new Function`, `require` call, network or child-process use; the file system is reachable only through an explicit `set_fs` call the reader never makes; Apache-2.0; no install scripts; no dependencies | not probed | `E7: ESM import works; no eval, network, file system or install scripts; Apache-2.0` |
| E8 5,000 x 20 within 2 s (should) | PASS: about 0.2 s in Vitest (205 ms observed); peak heap measured at cap size, see Measurements | not probed | `E8: 5,000 rows by 20 columns parse within 2 seconds` |
| Integrity | PASS: tarball SHA-256 equals the recorded file; pnpm lockfile sha512 equals the tarball; license present | n/a | `vendor-integrity.int.test.ts` (3 tests) |

Every probed fixture first passes the real `ZipArchiveInspector` (U3b1 and U3b2). The probe checks the library's raw output; no adapter is involved.

## Required parse options and hazards for U4

- Call `XLSX.read(bytes, { type: 'buffer', cellFormula: true, cellDates: true, cellStyles: true })`. `cellDates` is required for `t="d"`: with it off, a date cell is converted to an Excel serial number and the distinction is lost. `cellStyles` is required for hidden row and column flags.
- Dates were identical under TZ values Pacific/Auckland and America/Los_Angeles (the `Date` is UTC midnight or the stated instant).
- Silent failure: a cell of type `s` whose shared string table is missing makes the whole sheet disappear (`SheetNames` lists it, `Sheets[name]` is undefined). The reader must treat a name without a sheet object as a structure failure.
- Performance cliff: with `cellStyles: true` and no styles part in the package, parsing is about 10 times slower (5,527 rows by 20 columns: 2.3 s instead of 0.25 s). Workbooks from our template and from Excel carry a styles part. U4 should not enable `cellStyles` when the package has no `xl/styles.xml`, or should accept the slow path only below the row cap.
- Numeric lexical text is lost, so the cell model's `number.raw` is the shortest round-trip of the double. Very large or small values print in exponent form; the decimal field rules must reject or normalize those.
- Parsing is synchronous and blocks the event loop (about 7.5 s at cap size); this fits D8 (one validation at a time).

## Measurements (5.7)

Generated in a scratch directory (not in the repository) with a standalone ZIP writer: 20 columns, half text and half numeric cells, at most 50,000 rows per sheet, with a styles part. Each size parsed in its own Node 24 process (`--max-old-space-size=8192`) with `cellFormula`, `cellDates` and `cellStyles` on. Machine: 16 GB, macOS.

| Uncompressed size | Rows (sheets) | Compressed | Parse time | Heap used after parse | Peak RSS |
|---|---|---|---|---|---|
| 5.1 MB | 5,527 (1) | 0.9 MB | 0.24 s | 37 MB | 148 MB |
| 25.9 MB | 27,633 (1) | 4.6 MB | 1.2 s | 181 MB | 443 MB |
| 52 MB | 55,266 (2) | 9.2 MB | 2.3 s | 290 MB | 588 MB |
| 104 MB | 110,531 (3) | 18.3 MB | 4.5 s | 513 MB | 988 MB |
| 156 MB (cap, rounded up from 150 MB) | 165,797 (4) | 27.5 MB | 7.6 s | 694 MB | 1,212 MB |

Time and memory grow linearly. Peak heap was not sampled during the parse (the parse is synchronous); the peak process RSS (1.21 GB) is an upper bound for it and sits below the 1.5 GB threshold. The cap-size file is 27.5 MB compressed, above the 20 MB upload cap, so a real upload that large is refused earlier; the measurement still bounds the uncompressed path.

**Cap decision: keep `maxUncompressedBytes` at 150 MB.** No change to `workbook-limits.ts` or its test.

## Process notes

- RED then GREEN. Probe: the first run failed on two wrong expectations of mine (a shared formula dependent shifts `A1+1` to `A2+1`; a `s` cell needs a registered shared string table, otherwise the sheet vanishes), then passed after correcting the fixtures. Integrity test: RED observed by temporarily corrupting the first digits of the recorded hash (one failure, expected hash against computed hash), then restored.
- VS3 (5.1): in a scratch project outside the repository, a `file:` tarball dependency produced a lockfile entry with `integrity: sha512-...` (pnpm 9.15.4 there); in the repository pnpm 12.11.2 recorded the same integrity and printed "Lockfile passes supply-chain policies". No install script ran and no `allowBuilds` entry was needed for `xlsx`. The `modern-xlsx` parts of VS3 (`minimumReleaseAge`, `allowBuilds`, WASM under Vitest) were not exercised because SheetJS won; they remain unverified.
- Deleted losing candidates (5.12): none existed (no `modern-xlsx` dependency or probe was ever created).
- Not covered: dynamic array formulas (builder limitation); `modern-xlsx` behaviour.
