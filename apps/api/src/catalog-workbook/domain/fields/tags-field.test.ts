import { describe, expect, it } from 'vitest';
import { parseTags } from './tags-field.js';

const text = (value: string) => ({ kind: 'text', text: value }) as const;

describe('parseTags', () => {
  it('trims, drops empties and removes case-insensitive duplicates keeping the first', () => {
    expect(parseTags(text('verano, Verano ,, oferta'))).toEqual({
      ok: true,
      value: ['verano', 'oferta'],
    });
  });

  it('gives an empty list for an empty cell', () => {
    expect(parseTags({ kind: 'empty' })).toEqual({ ok: true, value: [] });
  });

  it('warns about more than 250 tags and keeps them', () => {
    const many = Array.from({ length: 251 }, (_, index) => `t${index}`).join(',');
    const result = parseTags(text(many));
    expect(result).toMatchObject({ ok: true, warning: 'TAG_LIMIT_EXCEEDED' });
    expect(result.ok && result.value).toHaveLength(251);
  });

  it('accepts 250 tags of 255 characters', () => {
    const tags = Array.from({ length: 250 }, (_, index) => `${index}`.padEnd(255, 'x')).join(',');
    expect(parseTags(text(tags))).not.toHaveProperty('warning');
  });

  it('warns about a tag of 256 characters', () => {
    expect(parseTags(text('x'.repeat(256)))).toMatchObject({
      ok: true,
      warning: 'TAG_LIMIT_EXCEEDED',
    });
  });

  it('flags an error cell', () => {
    expect(parseTags({ kind: 'error', code: '#N/A' })).toEqual({
      ok: false,
      reason: 'CELL_ERROR_VALUE',
    });
  });
});
