import type { ValidationReport } from '@importer/contracts';
import type { ImportableCatalog } from '../domain/importable-catalog.js';

/** The workbook validation the import re-runs; the draft exists only for a report without errors. */
export interface WorkbookValidator {
  validate(
    bytes: Uint8Array,
    sha256: string,
  ): Promise<{ readonly report: ValidationReport; readonly draft?: ImportableCatalog }>;
}
