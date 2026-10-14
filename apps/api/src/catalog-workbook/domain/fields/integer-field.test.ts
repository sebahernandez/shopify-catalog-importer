import { describe, expect, it } from 'vitest';
import { parseInteger } from './integer-field.js';

const text = (value: string) => ({ kind: 'text', text: value }) as const;

describe('parseInteger', () => {
  it('accepts digits from text and from a number cell', () => {
    expect(parseInteger(text('3'))).toEqual({ ok: true, value: 3 });
    expect(parseInteger({ kind: 'number', raw: '12' })).toEqual({ ok: true, value: 12 });
  });

  it.each(['-1', '2.5', 'abc', '1E+3'])('rejects %s', (input) => {
    expect(parseInteger(text(input))).toEqual({ ok: false, reason: 'INTEGER_INVALID' });
  });

  it('enforces the minimum', () => {
    expect(parseInteger(text('0'), { min: 1 })).toEqual({ ok: false, reason: 'INTEGER_INVALID' });
    expect(parseInteger(text('1'), { min: 1 })).toEqual({ ok: true, value: 1 });
  });

  it('enforces the 32-bit bound', () => {
    expect(parseInteger(text('2147483647'), { max: 2_147_483_647 })).toMatchObject({ ok: true });
    expect(parseInteger(text('2147483648'), { max: 2_147_483_647 })).toEqual({
      ok: false,
      reason: 'INTEGER_INVALID',
    });
  });

  it('returns no value for an empty cell and flags a date cell', () => {
    expect(parseInteger({ kind: 'empty' })).toEqual({ ok: true, value: undefined });
    expect(parseInteger({ kind: 'date', iso: '2026-01-01' })).toEqual({
      ok: false,
      reason: 'CELL_TYPE_UNEXPECTED',
    });
  });
});
