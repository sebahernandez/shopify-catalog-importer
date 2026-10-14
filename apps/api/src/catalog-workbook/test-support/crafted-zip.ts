import { crc32 } from 'node:zlib';
import { writeZip, type ZipEntry } from '../infrastructure/ooxml/zip-writer.js';

// Test-only byte-level builders for archives that writeZip refuses to produce. Each starts from a
// well-formed archive and patches the header fields the case is about.

const entry = (name = 'xl/a.xml'): ZipEntry => ({ name, data: Buffer.from('<a/>') });

interface Record {
  readonly central: number;
  readonly local: number;
}

/** Runs `edit` on every entry's central and local header offsets in a copy of the archive. */
function patched(zip: Buffer, edit: (zip: Buffer, record: Record, index: number) => void): Buffer {
  const copy = Buffer.from(zip);
  const count = copy.readUInt16LE(copy.length - 12);
  let central = copy.readUInt32LE(copy.length - 6);
  for (let index = 0; index < count; index += 1) {
    edit(copy, { central, local: copy.readUInt32LE(central + 42) }, index);
    central += 46 + copy.readUInt16LE(central + 28);
  }
  return copy;
}

const named = (name: string) => writeZip([entry(name)]);
const patchAll = (field: (zip: Buffer, record: Record) => void) => () =>
  patched(writeZip([entry()]), field);

export const notZip = (): Buffer => Buffer.from('this is plain text, not an archive');
export const cfbHeader = (): Buffer =>
  Buffer.concat([Buffer.from('d0cf11e0a1b11ae1', 'hex'), Buffer.alloc(504)]);

/** A ZIP64 locator before the end record and saturated end-record fields. */
export function zip64(): Buffer {
  const zip = writeZip([entry()]);
  const locator = Buffer.alloc(20);
  locator.writeUInt32LE(0x07064b50, 0);
  locator.writeUInt32LE(1, 16); // total disks
  const end = Buffer.from(zip.subarray(zip.length - 22));
  end.writeUInt16LE(0xffff, 8);
  end.writeUInt16LE(0xffff, 10);
  end.writeUInt32LE(0xffffffff, 16);
  return Buffer.concat([zip.subarray(0, zip.length - 22), locator, end]);
}

export function multiDisk(): Buffer {
  const zip = writeZip([entry()]);
  zip.writeUInt16LE(1, zip.length - 18);
  return zip;
}

export const encrypted = patchAll((zip, { central, local }) => {
  zip.writeUInt16LE(zip.readUInt16LE(central + 8) | 1, central + 8);
  zip.writeUInt16LE(zip.readUInt16LE(local + 6) | 1, local + 6);
});

export const method12 = patchAll((zip, { central, local }) => {
  zip.writeUInt16LE(12, central + 10);
  zip.writeUInt16LE(12, local + 8);
});

export const traversalName = () => named('../evil.xml');
export const absoluteName = () => named('/etc/evil.xml');
export const duplicateName = () => writeZip([entry(), entry()]);

/** The headers claim a 1-byte uncompressed size while the stream inflates to more. */
export const lyingSizes = patchAll((zip, { central, local }) => {
  zip.writeUInt32LE(1, central + 24);
  zip.writeUInt32LE(1, local + 22);
});

/** The second entry's local header offset points at the first entry. */
export const overlappingEntries = (): Buffer =>
  patched(writeZip([entry('xl/a.xml'), entry('xl/b.xml')]), (zip, { central }, index) => {
    if (index === 1) zip.writeUInt32LE(0, central + 42);
  });

export const crcMismatch = patchAll((zip, { central, local }) => {
  zip.writeUInt32LE((crc32(Buffer.from('<a/>')) ^ 0xdeadbeef) >>> 0, central + 16);
  zip.writeUInt32LE((crc32(Buffer.from('<a/>')) ^ 0xdeadbeef) >>> 0, local + 14);
});

/** One entry of `size` zero bytes: tiny when deflated, enormous when inflated. */
export const ratioBomb = (size: number): Buffer =>
  writeZip([{ name: 'xl/bomb.xml', data: Buffer.alloc(size) }]);

export const manyEntries = (count: number): Buffer =>
  writeZip(Array.from({ length: count }, (_, index) => entry(`xl/part${index}.xml`)));
