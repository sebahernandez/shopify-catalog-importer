import type { IssueCode } from '@importer/contracts';

/** A file-level finding: a catalog code and its params, never tied to a sheet. */
export interface FileFinding {
  readonly code: IssueCode;
  readonly params: Readonly<Record<string, string | number | boolean>>;
}

/** The caps the archive checks enforce; `WorkbookLimits` satisfies this shape. */
export interface ArchiveLimits {
  readonly maxEntries: number;
  readonly maxUncompressedBytes: number;
  readonly maxRatio: number;
}

/** Where an entry lives in the verified bytes, so later steps can inflate only what they need. */
export interface ArchiveEntry {
  readonly name: string;
  readonly method: 0 | 8;
  readonly dataOffset: number;
  readonly compressedSize: number;
  readonly size: number;
}

/** An archive whose structure and real inflated sizes passed every check. */
export interface VerifiedArchive {
  readonly entries: readonly ArchiveEntry[];
  /** Worksheet parts that hold at least one formula element. */
  readonly formulaParts: readonly string[];
}

export type Inspection =
  | { readonly ok: true; readonly archive: VerifiedArchive }
  | { readonly ok: false; readonly findings: readonly FileFinding[] };

export interface ArchiveInspector {
  inspect(bytes: Uint8Array, limits: ArchiveLimits): Inspection;
}
