import type { CatalogDraft } from '../domain/catalog-draft.js';
import { buildCatalogDraft } from '../domain/build-catalog-draft.js';
import { IssueCollector } from '../domain/issue-collector.js';
import { crossSheetRules } from '../domain/rules/cross-sheet-rules.js';
import { imagenesRules } from '../domain/rules/imagenes-rules.js';
import { productosRules } from '../domain/rules/productos-rules.js';
import { variantesBarcodeRules } from '../domain/rules/variantes-barcode-rules.js';
import { variantesIdentityRules } from '../domain/rules/variantes-identity-rules.js';
import { variantesInventoryRules } from '../domain/rules/variantes-inventory-rules.js';
import { variantesOptionsRules } from '../domain/rules/variantes-options-rules.js';
import { variantesPriceRules } from '../domain/rules/variantes-price-rules.js';
import { readRows, reportReadFailure, type SourceRow } from '../domain/structure/read-rows.js';
import { resolveHeaders } from '../domain/structure/resolve-headers.js';
import { resolveSheets } from '../domain/structure/resolve-sheets.js';
import type { WorkbookSheet } from '../domain/workbook-cell.js';
import type { WorkbookLimits } from '../domain/workbook-limits.js';
import type { ArchiveInspector, FileFinding } from '../ports/archive-inspector.port.js';
import type { ReadResult, WorkbookReader } from '../ports/workbook-reader.port.js';
import { assembleReport, productKeyIndex } from './assemble-report.js';
import { guardFormulas } from './formula-guard.js';
import type { ValidationReport } from '@importer/contracts';

export interface ValidationOutcome {
  readonly report: ValidationReport;
  /** Present only when the report has no errors. */
  readonly draft?: CatalogDraft;
}

/**
 * Runs the whole validation as a pure function of the bytes: preflight, read, formula guard,
 * structure, per-sheet rules, cross-sheet rules, assembly and draft. It keeps no state between
 * runs and touches no network, file system or database; `fileSha256` arrives computed.
 */
export class ValidateWorkbookUseCase {
  constructor(
    private readonly inspector: ArchiveInspector,
    private readonly reader: WorkbookReader,
    private readonly limits: WorkbookLimits,
  ) {}

  async execute(bytes: Uint8Array, fileSha256: string): Promise<ValidationOutcome> {
    const sink = new IssueCollector(this.limits.maxReportedIssues);
    const stop = (findings: readonly FileFinding[]): ValidationOutcome => {
      for (const { code, params } of findings) {
        sink.add({ severity: 'error', code, sheet: null, row: null, field: null, params });
      }
      return { report: assembleReport(sink.build(), fileSha256) };
    };

    const inspection = this.inspector.inspect(bytes, this.limits);
    if (!inspection.ok) return stop(inspection.findings);

    const read = await this.read(bytes, inspection.archive);
    if (!read.ok) {
      if (read.finding.code === 'FILE_UNREADABLE') return stop([read.finding]);
      reportReadFailure(read, sink);
      return { report: assembleReport(sink.build(), fileSha256) };
    }
    const guard = guardFormulas(inspection.archive.formulaParts, read.sheets);
    if (guard.length > 0) return stop(guard);

    const { products, variants, images } = this.validateSheets(read.sheets, sink);
    const collected = sink.build();
    const report = assembleReport(
      collected,
      fileSha256,
      productKeyIndex(products, variants, images),
    );
    const draft = buildCatalogDraft(collected.errorCount, products, variants, images);
    return draft === undefined ? { report } : { report, draft };
  }

  /** A reader failure never leaks: the error is dropped and replaced by a generic finding. */
  private async read(bytes: Uint8Array, archive: Parameters<WorkbookReader['read']>[1]) {
    try {
      return await this.reader.read(bytes, archive, this.limits);
    } catch {
      const failed: ReadResult = {
        ok: false,
        finding: { code: 'FILE_UNREADABLE', params: {} },
      };
      return failed;
    }
  }

  private validateSheets(sheets: readonly WorkbookSheet[], sink: IssueCollector) {
    const resolved = resolveSheets(sheets, sink);
    const rowsOf = (name: 'Productos' | 'Variantes' | 'Imagenes'): SourceRow[] | undefined => {
      const sheet = resolved.get(name);
      if (sheet === undefined) return undefined;
      const headers = resolveHeaders(name, sheet, sink);
      return headers.usable ? readRows(name, sheet, headers.columns, sink) : undefined;
    };
    const productRows = rowsOf('Productos');
    const variantRows = rowsOf('Variantes');
    const imageRows = rowsOf('Imagenes');

    const products = productRows === undefined ? [] : productosRules(productRows, sink);
    let variants = variantRows === undefined ? [] : variantesIdentityRules(variantRows, sink);
    if (variantRows !== undefined) {
      variants = variantesOptionsRules(variantRows, variants, sink);
      variants = variantesPriceRules(variantRows, variants, sink);
      variants = variantesBarcodeRules(variantRows, variants, sink);
      variants = variantesInventoryRules(variantRows, variants, sink);
    }
    const images = imageRows === undefined ? [] : imagenesRules(imageRows, variants, sink);
    // With a sheet skipped, its keys would all look unknown; the sheet is already reported.
    if (productRows && variantRows && imageRows) crossSheetRules(products, variants, images, sink);
    return { products, variants, images };
  }
}
