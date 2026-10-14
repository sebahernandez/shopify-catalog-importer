import { crc32, deflateRawSync } from 'node:zlib';

export interface ZipEntry {
  readonly name: string;
  readonly data: Buffer;
  readonly method?: 'stored' | 'deflate';
}

// Fixed DOS timestamp (1980-01-01 00:00) so equal input gives equal bytes.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

/** Writes a classic (non-ZIP64) archive with no comment; entries keep their given order. */
export function writeZip(entries: readonly ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const deflated = (entry.method ?? 'deflate') === 'deflate';
    const payload = deflated ? deflateRawSync(entry.data) : entry.data;
    const common = Buffer.alloc(26);
    common.writeUInt16LE(20, 0); // version needed
    common.writeUInt16LE(0x0800, 2); // UTF-8 names
    common.writeUInt16LE(deflated ? 8 : 0, 4);
    common.writeUInt16LE(DOS_TIME, 6);
    common.writeUInt16LE(DOS_DATE, 8);
    common.writeUInt32LE(crc32(entry.data), 10);
    common.writeUInt32LE(payload.length, 14);
    common.writeUInt32LE(entry.data.length, 18);
    common.writeUInt16LE(name.length, 22);
    const local = Buffer.concat([Buffer.from('504b0304', 'hex'), common, name, payload]);
    const central = Buffer.alloc(14);
    central.writeUInt32LE(offset, 10);
    centrals.push(
      Buffer.concat([
        Buffer.from('504b0102', 'hex'),
        Buffer.from([20, 0]), // version made by
        common,
        central, // comment, disk, attributes, local header offset
        name,
      ]),
    );
    locals.push(local);
    offset += local.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
