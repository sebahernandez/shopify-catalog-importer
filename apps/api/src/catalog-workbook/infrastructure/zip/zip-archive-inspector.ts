import type {
  ArchiveInspector,
  ArchiveLimits,
  Inspection,
} from '../../ports/archive-inspector.port.js';
import { preflightArchive } from './archive-preflight.js';
import { scanContent } from './content-scan.js';

/** Archive checks first (stop at the first problem), then the content scan (findings together). */
export class ZipArchiveInspector implements ArchiveInspector {
  inspect(bytes: Uint8Array, limits: ArchiveLimits): Inspection {
    const zip = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const archive = preflightArchive(zip, limits);
    if (!archive.ok) return archive;
    const content = scanContent(zip, archive.archive.entries);
    if (!content.ok) return content;
    return { ok: true, archive: { ...archive.archive, formulaParts: content.formulaParts } };
  }
}
