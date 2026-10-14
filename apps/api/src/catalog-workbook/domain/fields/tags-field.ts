import type { FieldValue } from '../workbook-cell.js';
import { type FieldResult, cellReason } from './field-result.js';

const MAX_TAGS = 250;
const MAX_TAG_CHARS = 255;

/** Comma-separated tags: trimmed, empties dropped, duplicates removed keeping the first spelling. */
export function parseTags(cell: FieldValue): FieldResult<string[], never, 'TAG_LIMIT_EXCEEDED'> {
  if (cell.kind === 'empty') {
    return { ok: true, value: [] };
  }
  if (cell.kind !== 'text' && cell.kind !== 'number') {
    return { ok: false, reason: cellReason(cell) };
  }
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of (cell.kind === 'text' ? cell.text : cell.raw).split(',')) {
    const tag = part.trim();
    if (tag !== '' && !seen.has(tag.toLowerCase())) {
      seen.add(tag.toLowerCase());
      tags.push(tag);
    }
  }
  const overLimit = tags.length > MAX_TAGS || tags.some((tag) => tag.length > MAX_TAG_CHARS);
  return overLimit
    ? { ok: true, value: tags, warning: 'TAG_LIMIT_EXCEEDED' }
    : { ok: true, value: tags };
}
