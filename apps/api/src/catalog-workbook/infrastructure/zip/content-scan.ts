import type { ArchiveEntry, FileFinding } from '../../ports/archive-inspector.port.js';
import { boundedInflate } from './bounded-inflate.js';

export type ContentScan =
  | { readonly ok: true; readonly formulaParts: readonly string[] }
  | { readonly ok: false; readonly findings: readonly FileFinding[] };

const CONTENT_TYPES = '[content_types].xml';
const WORKBOOK = 'xl/workbook.xml';
const WORKBOOK_RELS = 'xl/_rels/workbook.xml.rels';
const WORKSHEET = /^xl\/worksheets\/[^/]+\.xml$/;
const MACRO_TYPE = /macroEnabled|vbaProject|macrosheet/i;
const EXTERNAL_TARGET = /TargetMode\s*=\s*["']External["']/i;
// Prefix tolerant: matches <f>, <f t="shared"> and <x:f>, but not <fooBar> or <sheetFormatPr>.
const FORMULA = /<(?:[\w.-]+:)?f[\s/>]/;

const finding = (code: FileFinding['code']): FileFinding => ({ code, params: {} });

/** Step 7: control parts and worksheet XML only, over entries whose real sizes are verified. */
export function scanContent(zip: Buffer, entries: readonly ArchiveEntry[]): ContentScan {
  const byName = new Map(entries.map((entry) => [entry.name.toLowerCase(), entry]));
  const names = [...byName.keys()];
  const text = (name: string): string => {
    const entry = byName.get(name);
    if (!entry) return '';
    const data = zip.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
    const inflated =
      entry.method === 0
        ? { ok: true as const, bytes: data }
        : boundedInflate(data, entry.size + 1);
    return inflated.ok ? inflated.bytes.toString('utf8') : '';
  };
  if (!byName.has(CONTENT_TYPES) || !byName.has(WORKBOOK)) {
    return { ok: false, findings: [finding('FILE_NOT_XLSX')] };
  }
  const has = (fragment: string) => names.some((name) => name.includes(fragment));
  const findings: FileFinding[] = [];
  if (has('vbaproject') || has('xl/macrosheets/') || MACRO_TYPE.test(text(CONTENT_TYPES))) {
    findings.push(finding('MACROS_NOT_ALLOWED'));
  }
  if (has('xl/externallinks/') || EXTERNAL_TARGET.test(text(WORKBOOK_RELS))) {
    findings.push(finding('EXTERNAL_LINKS_NOT_ALLOWED'));
  }
  if (has('xl/embeddings/') || has('xl/activex/')) {
    findings.push(finding('EMBEDDED_CONTENT_NOT_ALLOWED'));
  }
  if (findings.length > 0) return { ok: false, findings };
  const formulaParts = entries
    .filter((entry) => WORKSHEET.test(entry.name.toLowerCase()))
    .filter((entry) => FORMULA.test(text(entry.name.toLowerCase())))
    .map((entry) => entry.name);
  return { ok: true, formulaParts };
}
