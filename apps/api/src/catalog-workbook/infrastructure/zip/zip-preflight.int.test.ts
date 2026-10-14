import { deflateRawSync } from 'node:zlib';
import { writeZip } from '../ooxml/zip-writer.js';
import { describe, expect, it } from 'vitest';
import { withLimits, type WorkbookLimits } from '../../domain/workbook-limits.js';
import {
  absoluteName,
  cfbHeader,
  crcMismatch,
  duplicateName,
  encrypted,
  lyingSizes,
  manyEntries,
  method12,
  multiDisk,
  notZip,
  overlappingEntries,
  ratioBomb,
  traversalName,
  zip64,
} from '../../test-support/crafted-zip.js';
import { buildWorkbook } from '../../test-support/workbook-fixture-builder.js';
import { preflightArchive } from './archive-preflight.js';
import { boundedInflate } from './bounded-inflate.js';

const run = (zip: Buffer, overrides: Partial<WorkbookLimits> = {}) =>
  preflightArchive(zip, withLimits(overrides));
const codes = (zip: Buffer, overrides: Partial<WorkbookLimits> = {}) => {
  const result = run(zip, overrides);
  return result.ok ? [] : result.findings.map((finding) => finding.code);
};
const small = () => writeZip([{ name: 'xl/a.xml', data: Buffer.from('<a/>') }]);

describe('ZIP preflight, structure (steps 1 to 5)', () => {
  it('accepts a well formed workbook', () => {
    expect(run(buildWorkbook()).ok).toBe(true);
  });

  it('rejects bytes that are not a ZIP, and flags a CFB header as encrypted or legacy', () => {
    expect(codes(notZip())).toEqual(['FILE_NOT_XLSX']);
    expect(codes(cfbHeader())).toEqual(['FILE_ENCRYPTED_OR_LEGACY']);
    expect(codes(Buffer.alloc(0))).toEqual(['FILE_NOT_XLSX']);
  });

  it('rejects two end records, a comment that does not end the file, ZIP64 and multi-disk', () => {
    expect(codes(Buffer.concat([small(), small()]))).toEqual(['ZIP_AMBIGUOUS_ARCHIVE']);
    expect(codes(Buffer.concat([small(), Buffer.from('xx')]))).toEqual(['ZIP_AMBIGUOUS_ARCHIVE']);
    expect(codes(zip64())).toEqual(['ZIP_AMBIGUOUS_ARCHIVE']);
    expect(codes(multiDisk())).toEqual(['ZIP_AMBIGUOUS_ARCHIVE']);
  });

  it('rejects an archive without an end record', () => {
    expect(codes(small().subarray(0, 40))).toEqual(['FILE_NOT_XLSX']);
  });

  it('caps the entry count with limit and actual in params', () => {
    const result = run(manyEntries(201));
    expect(result).toEqual({
      ok: false,
      findings: [{ code: 'ZIP_TOO_MANY_ENTRIES', params: { limit: 200, actual: 201 } }],
    });
    expect(codes(manyEntries(200))).toEqual([]);
  });

  it('honours a cap override of 10 against 11 entries', () => {
    expect(run(manyEntries(11), { maxEntries: 10 })).toEqual({
      ok: false,
      findings: [{ code: 'ZIP_TOO_MANY_ENTRIES', params: { limit: 10, actual: 11 } }],
    });
  });

  it('rejects the encrypted flag and compression method 12', () => {
    expect(codes(encrypted())).toEqual(['FILE_ENCRYPTED_OR_LEGACY']);
    expect(codes(method12())).toEqual(['ZIP_AMBIGUOUS_ARCHIVE']);
  });

  it('rejects traversal and absolute names, backslashes, NUL and drive prefixes', () => {
    expect(codes(traversalName())).toEqual(['ZIP_UNSAFE_ENTRY_NAME']);
    expect(codes(absoluteName())).toEqual(['ZIP_UNSAFE_ENTRY_NAME']);
    for (const name of ['xl\\a.xml', 'xl/a\0.xml', 'C:/a.xml', '']) {
      const zip = writeZip([{ name, data: Buffer.from('<a/>') }]);
      expect(codes(zip), JSON.stringify(name)).toEqual(['ZIP_UNSAFE_ENTRY_NAME']);
    }
  });

  it('rejects duplicate names, also after case folding', () => {
    expect(codes(duplicateName())).toEqual(['ZIP_AMBIGUOUS_ARCHIVE']);
    const folded = writeZip([
      { name: 'xl/Workbook.xml', data: Buffer.from('<a/>') },
      { name: 'XL/workbook.xml', data: Buffer.from('<a/>') },
    ]);
    expect(codes(folded)).toEqual(['ZIP_AMBIGUOUS_ARCHIVE']);
  });

  it('rejects declared sizes whose sum is above the uncompressed cap', () => {
    expect(codes(small(), { maxUncompressedBytes: 3 })).toEqual(['ZIP_UNCOMPRESSED_TOO_LARGE']);
  });

  it('rejects a local header whose name differs from the central record', () => {
    const zip = Buffer.from(small());
    zip.write('b', 30 + 'xl/'.length); // local name 'xl/b.xml'
    expect(codes(zip)).toEqual(['ZIP_AMBIGUOUS_ARCHIVE']);
  });

  it('rejects a local header offset that is outside the file or has no signature', () => {
    for (const offset of [1, 100_000]) {
      const zip = Buffer.from(small());
      const record = zip.readUInt32LE(zip.length - 22 + 16);
      zip.writeUInt32LE(offset, record + 42);
      expect(codes(zip), String(offset)).toEqual(['ZIP_AMBIGUOUS_ARCHIVE']);
    }
  });

  it('rejects overlapping entries', () => {
    expect(codes(overlappingEntries())).toEqual(['ZIP_AMBIGUOUS_ARCHIVE']);
  });
});

describe('ZIP preflight, bounded real inflation (step 6)', () => {
  it('rejects declared sizes that lie, by the real size', () => {
    expect(codes(lyingSizes())).toEqual(['ZIP_AMBIGUOUS_ARCHIVE']);
    const crossed = run(lyingSizes(), { maxUncompressedBytes: 2 });
    expect(crossed).toEqual({
      ok: false,
      findings: [{ code: 'ZIP_UNCOMPRESSED_TOO_LARGE', params: { limit: 2, actual: 3 } }],
    });
  });

  it('rejects a bomb above the ratio with limit and observed value', () => {
    const result = run(ratioBomb(2 * 1024 * 1024));
    const [finding] = result.ok ? [] : result.findings;
    expect(finding?.code).toBe('ZIP_RATIO_EXCEEDED');
    expect(finding?.params.limit).toBe(100);
    expect(finding?.params.actual).toBeGreaterThan(100);
  });

  it('applies the ratio rule only above 1 MiB', () => {
    expect(codes(ratioBomb(500_000))).toEqual([]);
  });

  it('rejects a CRC mismatch', () => {
    expect(codes(crcMismatch())).toEqual(['ZIP_AMBIGUOUS_ARCHIVE']);
  });

  it('reads stored entries and rejects a stored size that lies', () => {
    const data = Buffer.from('<a/>');
    expect(codes(writeZip([{ name: 'xl/a.xml', data, method: 'stored' }]))).toEqual([]);
    const zip = writeZip([{ name: 'xl/a.xml', data, method: 'stored' }]);
    zip.writeUInt32LE(3, zip.readUInt32LE(zip.length - 6) + 24);
    expect(codes(zip)).toEqual(['ZIP_AMBIGUOUS_ARCHIVE']);
  });
});

describe('boundedInflate', () => {
  const bomb = deflateRawSync(Buffer.alloc(5_000_000));

  it('stops at the bound instead of producing the whole output', () => {
    expect(boundedInflate(bomb, 1000)).toEqual({ ok: false, reason: 'over' });
  });

  it('returns the bytes when they fit, and flags a corrupt stream', () => {
    const fits = boundedInflate(deflateRawSync(Buffer.from('<a/>')), 4);
    expect(fits.ok && fits.bytes.toString()).toBe('<a/>');
    expect(boundedInflate(Buffer.from('not deflate data at all'), 100)).toEqual({
      ok: false,
      reason: 'corrupt',
    });
  });
});
