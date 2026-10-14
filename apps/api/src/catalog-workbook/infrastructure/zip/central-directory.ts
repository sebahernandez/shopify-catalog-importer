import type {
  ArchiveEntry,
  ArchiveLimits,
  FileFinding,
} from '../../ports/archive-inspector.port.js';

export interface DirectoryEntry extends ArchiveEntry {
  readonly crc: number;
}

export type Step<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly finding: FileFinding };

const LOCAL_SIGNATURE = 0x04034b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const END_SIGNATURE = 0x06054b50;
const ZIP64_LOCATOR_SIGNATURE = 0x07064b50;
const END_RECORD_SIZE = 22;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const MAX_COMMENT = 0xffff;

const fail = (code: FileFinding['code'], params: FileFinding['params'] = {}): Step<never> => ({
  ok: false,
  finding: { code, params },
});
const ambiguous = () => fail('ZIP_AMBIGUOUS_ARCHIVE');

const unsafeName = (name: string): boolean =>
  name === '' ||
  /[\0\\]/.test(name) ||
  /^[A-Za-z]:/.test(name) ||
  name.startsWith('/') ||
  name.split('/').includes('..');

/** Step 2: exactly one end record, the comment ends the file, no multi-disk, no ZIP64. */
function findEndRecord(zip: Buffer): Step<number> {
  const found: number[] = [];
  const lowest = Math.max(0, zip.length - (END_RECORD_SIZE + MAX_COMMENT));
  for (let at = zip.length - END_RECORD_SIZE; at >= lowest; at -= 1) {
    if (zip.readUInt32LE(at) === END_SIGNATURE) found.push(at);
  }
  const [end] = found;
  if (end === undefined) return fail('FILE_NOT_XLSX');
  if (found.length > 1 || end + END_RECORD_SIZE + zip.readUInt16LE(end + 20) !== zip.length) {
    return ambiguous();
  }
  const sentinel =
    zip.readUInt16LE(end + 8) === 0xffff ||
    zip.readUInt16LE(end + 10) === 0xffff ||
    zip.readUInt32LE(end + 12) === 0xffffffff ||
    zip.readUInt32LE(end + 16) === 0xffffffff;
  const locator = end >= 20 && zip.readUInt32LE(end - 20) === ZIP64_LOCATOR_SIGNATURE;
  const multiDisk =
    zip.readUInt16LE(end + 4) !== 0 ||
    zip.readUInt16LE(end + 6) !== 0 ||
    zip.readUInt16LE(end + 8) !== zip.readUInt16LE(end + 10);
  return sentinel || locator || multiDisk ? ambiguous() : { ok: true, value: end };
}

/** Steps 3 and 4: entry count, then the directory walk with per-record and per-name checks. */
function walkDirectory(zip: Buffer, end: number, limits: ArchiveLimits): Step<DirectoryEntry[]> {
  const count = zip.readUInt16LE(end + 10);
  if (count > limits.maxEntries) {
    return fail('ZIP_TOO_MANY_ENTRIES', { limit: limits.maxEntries, actual: count });
  }
  const directoryEnd = zip.readUInt32LE(end + 16) + zip.readUInt32LE(end + 12);
  if (directoryEnd > end) return ambiguous();
  const entries: DirectoryEntry[] = [];
  const seen = new Set<string>();
  let total = 0;
  let at = zip.readUInt32LE(end + 16);
  for (let index = 0; index < count; index += 1) {
    if (at + CENTRAL_HEADER_SIZE > directoryEnd || zip.readUInt32LE(at) !== CENTRAL_SIGNATURE) {
      return ambiguous();
    }
    const nameEnd = at + CENTRAL_HEADER_SIZE + zip.readUInt16LE(at + 28);
    const next = nameEnd + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
    if (next > directoryEnd) return ambiguous();
    const name = zip.toString('utf8', at + CENTRAL_HEADER_SIZE, nameEnd);
    const method = zip.readUInt16LE(at + 10);
    if (zip.readUInt16LE(at + 8) & 1) return fail('FILE_ENCRYPTED_OR_LEGACY');
    if (method !== 0 && method !== 8) return ambiguous();
    if (unsafeName(name)) return fail('ZIP_UNSAFE_ENTRY_NAME');
    if (seen.has(name.toLowerCase())) return ambiguous();
    seen.add(name.toLowerCase());
    const size = zip.readUInt32LE(at + 24);
    total += size;
    entries.push({
      name,
      method,
      crc: zip.readUInt32LE(at + 16),
      compressedSize: zip.readUInt32LE(at + 20),
      size,
      dataOffset: zip.readUInt32LE(at + 42), // the local header offset until step 5 resolves it
    });
    at = next;
  }
  if (at !== directoryEnd) return ambiguous();
  return total > limits.maxUncompressedBytes
    ? fail('ZIP_UNCOMPRESSED_TOO_LARGE', { limit: limits.maxUncompressedBytes, actual: total })
    : { ok: true, value: entries };
}

/** Step 5: every local header is valid and named like its record; data ranges do not overlap. */
function resolveLocalHeaders(zip: Buffer, directoryStart: number, entries: DirectoryEntry[]) {
  const ranges: { start: number; end: number }[] = [];
  const resolved: DirectoryEntry[] = [];
  for (const entry of entries) {
    const start = entry.dataOffset;
    if (start + LOCAL_HEADER_SIZE > directoryStart) return ambiguous();
    if (zip.readUInt32LE(start) !== LOCAL_SIGNATURE) return ambiguous();
    const nameEnd = start + LOCAL_HEADER_SIZE + zip.readUInt16LE(start + 26);
    if (zip.toString('utf8', start + LOCAL_HEADER_SIZE, nameEnd) !== entry.name) return ambiguous();
    const dataOffset = nameEnd + zip.readUInt16LE(start + 28);
    const dataEnd = dataOffset + entry.compressedSize;
    if (dataEnd > directoryStart) return ambiguous();
    ranges.push({ start, end: dataEnd });
    resolved.push({ ...entry, dataOffset });
  }
  ranges.sort((left, right) => left.start - right.start);
  const overlaps = ranges.some(
    (range, index) => index > 0 && range.start < (ranges[index - 1]?.end ?? 0),
  );
  return overlaps ? ambiguous() : ({ ok: true, value: resolved } as const);
}

/** Steps 1 to 5 of the preflight. Returns entries with their data offsets resolved. */
export function readStructure(zip: Buffer, limits: ArchiveLimits): Step<DirectoryEntry[]> {
  if (zip.length >= 4 && zip.readUInt32LE(0) === 0xe011cfd0) {
    return fail('FILE_ENCRYPTED_OR_LEGACY');
  }
  if (zip.length < 4 || zip.readUInt32LE(0) !== LOCAL_SIGNATURE) return fail('FILE_NOT_XLSX');
  const end = findEndRecord(zip);
  if (!end.ok) return end;
  const walked = walkDirectory(zip, end.value, limits);
  return walked.ok
    ? resolveLocalHeaders(zip, zip.readUInt32LE(end.value + 16), walked.value)
    : walked;
}
