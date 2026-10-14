import type { WorkbookSheet } from '../domain/workbook-cell.js';
import type { FileFinding, VerifiedArchive } from './archive-inspector.port.js';

/** The caps a reader enforces while it maps cells; `WorkbookLimits` satisfies this shape. */
export interface SheetLimits {
  /** Data rows, so the header row does not count. */
  readonly maxRows: number;
  readonly maxColumns: number;
  /** UTF-16 code units, the unit Excel itself counts. */
  readonly maxCellChars: number;
}

/** Where a failing cell sits (1-based), for the one failure that is about a single cell. */
export interface CellLocation {
  readonly sheet: string;
  readonly row: number;
  readonly col: number;
}

export type ReadResult =
  | { readonly ok: true; readonly sheets: readonly WorkbookSheet[] }
  | { readonly ok: false; readonly finding: FileFinding; readonly cell?: CellLocation };

export interface WorkbookReader {
  /** `archive` is the output of the preflight for these same bytes. */
  read(bytes: Uint8Array, archive: VerifiedArchive, limits: SheetLimits): Promise<ReadResult>;
}
