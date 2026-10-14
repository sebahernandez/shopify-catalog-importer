import { crc32 } from 'node:zlib';
import type { ArchiveLimits, FileFinding, Inspection } from '../../ports/archive-inspector.port.js';
import { boundedInflate } from './bounded-inflate.js';
import { readStructure, type DirectoryEntry } from './central-directory.js';

const RATIO_FLOOR_BYTES = 1024 * 1024;
const ambiguous: FileFinding = { code: 'ZIP_AMBIGUOUS_ARCHIVE', params: {} };

/** Step 6 for one entry: real size, CRC, total and ratio. Returns the new total or a finding. */
function inspectEntry(
  zip: Buffer,
  entry: DirectoryEntry,
  used: number,
  limits: ArchiveLimits,
): { total: number } | { finding: FileFinding } {
  const data = zip.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  const bound = Math.min(limits.maxUncompressedBytes - used, entry.size) + 1;
  const inflated =
    entry.method === 0 ? { ok: true as const, bytes: data } : boundedInflate(data, bound);
  if (!inflated.ok && inflated.reason === 'corrupt') return { finding: ambiguous };
  // When the bound is crossed the real size is at least bound + 1; that is all that is observed.
  const observed = inflated.ok ? inflated.bytes.length : bound + 1;
  const total = used + observed;
  if (total > limits.maxUncompressedBytes) {
    const params = { limit: limits.maxUncompressedBytes, actual: total };
    return { finding: { code: 'ZIP_UNCOMPRESSED_TOO_LARGE', params } };
  }
  if (!inflated.ok || observed !== entry.size || crc32(inflated.bytes) !== entry.crc) {
    return { finding: ambiguous };
  }
  const ratio = observed / Math.max(1, entry.compressedSize);
  if (observed > RATIO_FLOOR_BYTES && ratio > limits.maxRatio) {
    const params = { limit: limits.maxRatio, actual: Math.ceil(ratio) };
    return { finding: { code: 'ZIP_RATIO_EXCEEDED', params } };
  }
  return { total };
}

/** Runs the archive checks (design steps 1 to 6) over the whole upload, in memory. */
export function preflightArchive(zip: Buffer, limits: ArchiveLimits): Inspection {
  const structure = readStructure(zip, limits);
  if (!structure.ok) return { ok: false, findings: [structure.finding] };
  let used = 0;
  for (const entry of structure.value) {
    const result = inspectEntry(zip, entry, used, limits);
    if ('finding' in result) return { ok: false, findings: [result.finding] };
    used = result.total;
  }
  return { ok: true, archive: { entries: structure.value, formulaParts: [] } };
}
