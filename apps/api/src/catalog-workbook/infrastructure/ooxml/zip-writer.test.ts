import { createHash } from 'node:crypto';
import { crc32, inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { writeZip } from './zip-writer.js';

const text = (value: string) => Buffer.from(value, 'utf8');
const entries = [
  { name: 'a.txt', data: text('hello hello hello hello'), method: 'deflate' as const },
  { name: 'dir/b.txt', data: text('stored bytes'), method: 'stored' as const },
];

describe('writeZip', () => {
  const zip = writeZip(entries);
  const end = zip.length - 22;
  const count = zip.readUInt16LE(end + 10);
  const directoryOffset = zip.readUInt32LE(end + 16);

  it('ends with a well formed end record and no comment', () => {
    expect(zip.readUInt32LE(end)).toBe(0x06054b50);
    expect(count).toBe(2);
    expect(zip.readUInt16LE(end + 8)).toBe(2);
    expect(zip.readUInt32LE(end + 12)).toBe(end - directoryOffset);
    expect(zip.readUInt16LE(end + 20)).toBe(0);
  });

  it('writes each local header, central record and payload consistently', () => {
    let central = directoryOffset;
    for (const entry of entries) {
      expect(zip.readUInt32LE(central)).toBe(0x02014b50);
      const method = zip.readUInt16LE(central + 10);
      const crc = zip.readUInt32LE(central + 16);
      const compressed = zip.readUInt32LE(central + 20);
      const size = zip.readUInt32LE(central + 24);
      const nameLength = zip.readUInt16LE(central + 28);
      const local = zip.readUInt32LE(central + 42);
      expect(zip.subarray(central + 46, central + 46 + nameLength).toString()).toBe(entry.name);
      expect(method).toBe(entry.method === 'stored' ? 0 : 8);
      expect(crc).toBe(crc32(entry.data));
      expect(size).toBe(entry.data.length);
      expect(zip.readUInt32LE(local)).toBe(0x04034b50);
      expect(zip.readUInt32LE(local + 14)).toBe(crc);
      expect(zip.readUInt32LE(local + 18)).toBe(compressed);
      expect(zip.readUInt16LE(local + 26)).toBe(nameLength);
      const payload = zip.subarray(local + 30 + nameLength, local + 30 + nameLength + compressed);
      const body = method === 0 ? payload : inflateRawSync(payload);
      expect(body.equals(entry.data)).toBe(true);
      central += 46 + nameLength;
    }
    expect(central).toBe(end);
  });

  it('is deterministic: the same input gives the same SHA-256', () => {
    const digest = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
    expect(digest(writeZip(entries))).toBe(digest(zip));
  });
});
