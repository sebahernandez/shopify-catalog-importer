import { crc32, inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
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
} from './crafted-zip.js';

const eocd = (zip: Buffer) => zip.length - 22;
// Central record offsets in order; every record here is the fixed 46 bytes plus its name.
const records = (zip: Buffer): number[] => {
  const found: number[] = [];
  let at = zip.readUInt32LE(eocd(zip) + 16);
  while (zip.readUInt32LE(at) === 0x02014b50) {
    found.push(at);
    at += 46 + zip.readUInt16LE(at + 28);
  }
  return found;
};
const name = (zip: Buffer, at: number) =>
  zip.toString('utf8', at + 46, at + 46 + zip.readUInt16LE(at + 28));

describe('crafted archives', () => {
  it('starts with something other than a ZIP signature, or with a CFB header', () => {
    expect(notZip().readUInt32LE(0)).not.toBe(0x04034b50);
    expect(cfbHeader().subarray(0, 8).toString('hex')).toBe('d0cf11e0a1b11ae1');
  });

  it('marks ZIP64 with a locator and saturated end-record fields', () => {
    const zip = zip64();
    expect(zip.readUInt32LE(eocd(zip) - 20)).toBe(0x07064b50);
    expect(zip.readUInt16LE(eocd(zip) + 10)).toBe(0xffff);
  });

  it('declares a second disk, an encrypted entry and compression method 12', () => {
    expect(multiDisk().readUInt16LE(eocd(multiDisk()) + 4)).toBe(1);
    const [flagged] = records(encrypted());
    expect(encrypted().readUInt16LE((flagged ?? 0) + 8) & 1).toBe(1);
    const [bzip] = records(method12());
    expect(method12().readUInt16LE((bzip ?? 0) + 10)).toBe(12);
  });

  it('carries unsafe or repeated entry names', () => {
    expect(records(traversalName()).map((at) => name(traversalName(), at))).toEqual([
      '../evil.xml',
    ]);
    expect(records(absoluteName()).map((at) => name(absoluteName(), at))).toEqual([
      '/etc/evil.xml',
    ]);
    const names = records(duplicateName()).map((at) => name(duplicateName(), at));
    expect(names).toEqual(['xl/a.xml', 'xl/a.xml']);
  });

  it('lies about sizes, overlaps entries and breaks the CRC', () => {
    const lying = lyingSizes();
    const [lie] = records(lying);
    expect(lying.readUInt32LE((lie ?? 0) + 24)).toBe(1);
    const overlap = overlappingEntries();
    const [first, second] = records(overlap);
    expect(overlap.readUInt32LE((second ?? 0) + 42)).toBe(overlap.readUInt32LE((first ?? 0) + 42));
    const bad = crcMismatch();
    const [only] = records(bad);
    expect(bad.readUInt32LE((only ?? 0) + 16)).not.toBe(crc32(Buffer.from('<a/>')));
  });

  it('builds a ratio bomb and an archive with many entries', () => {
    const bomb = ratioBomb(2_000_000);
    const [at] = records(bomb);
    const packed = bomb.readUInt32LE((at ?? 0) + 20);
    expect(bomb.readUInt32LE((at ?? 0) + 24)).toBe(2_000_000);
    expect(2_000_000 / packed).toBeGreaterThan(500);
    const start = bomb.readUInt32LE((at ?? 0) + 42) + 30 + name(bomb, at ?? 0).length;
    expect(inflateRawSync(bomb.subarray(start, start + packed)).length).toBe(2_000_000);
    expect(records(manyEntries(300))).toHaveLength(300);
  });
});
