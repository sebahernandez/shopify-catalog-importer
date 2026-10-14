import { describe, expect, it } from 'vitest';
import { normalizeCell } from './workbook-cell.js';

describe('normalizeCell', () => {
  it('treats a missing cell and a blank cell as empty', () => {
    expect(normalizeCell(undefined)).toEqual({ kind: 'empty' });
    expect(normalizeCell({ kind: 'blank' })).toEqual({ kind: 'empty' });
  });

  it('treats whitespace-only text as empty', () => {
    expect(normalizeCell({ kind: 'text', text: '   \t' })).toEqual({ kind: 'empty' });
  });

  it('trims text', () => {
    expect(normalizeCell({ kind: 'text', text: '  hola ' })).toEqual({
      kind: 'text',
      text: 'hola',
    });
  });

  it('keeps the raw text of a number cell', () => {
    expect(normalizeCell({ kind: 'number', raw: '19.9' })).toEqual({ kind: 'number', raw: '19.9' });
  });

  it('passes boolean, error and date cells through', () => {
    expect(normalizeCell({ kind: 'boolean', value: true })).toEqual({
      kind: 'boolean',
      value: true,
    });
    expect(normalizeCell({ kind: 'error', code: '#N/A' })).toEqual({ kind: 'error', code: '#N/A' });
    expect(normalizeCell({ kind: 'date', iso: '2026-01-01' })).toEqual({
      kind: 'date',
      iso: '2026-01-01',
    });
  });
});
