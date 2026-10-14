import { matchKey } from '../match-key.js';
import type { FieldValue } from '../workbook-cell.js';
import { type FieldResult, cellReason } from './field-result.js';

const SPELLINGS: ReadonlyMap<string, boolean> = new Map([
  ['true', true],
  ['verdadero', true],
  ['si', true],
  ['1', true],
  ['false', false],
  ['falso', false],
  ['no', false],
  ['0', false],
]);

export function parseBoolean(cell: FieldValue): FieldResult<boolean, 'BOOLEAN_INVALID'> {
  switch (cell.kind) {
    case 'empty':
      return { ok: true, value: undefined };
    case 'boolean':
      return { ok: true, value: cell.value };
    case 'text':
    case 'number': {
      const value = SPELLINGS.get(matchKey(cell.kind === 'text' ? cell.text : cell.raw));
      return value === undefined ? { ok: false, reason: 'BOOLEAN_INVALID' } : { ok: true, value };
    }
    default:
      return { ok: false, reason: cellReason(cell) };
  }
}
