import { describe, expect, it } from 'vitest';
import { parseBoolean } from './boolean-field.js';

describe('parseBoolean', () => {
  it.each([
    ['Sí', true],
    ['SI', true],
    ['no', false],
    ['Verdadero', true],
    ['FALSO', false],
    ['1', true],
    ['0', false],
    [' true ', true],
  ])('reads text %s', (text, expected) => {
    expect(parseBoolean({ kind: 'text', text: text.trim() })).toEqual({
      ok: true,
      value: expected,
    });
  });

  it('reads a native boolean and a numeric 1', () => {
    expect(parseBoolean({ kind: 'boolean', value: true })).toEqual({ ok: true, value: true });
    expect(parseBoolean({ kind: 'number', raw: '0' })).toEqual({ ok: true, value: false });
  });

  it('rejects unknown spellings', () => {
    expect(parseBoolean({ kind: 'text', text: 'quizás' })).toEqual({
      ok: false,
      reason: 'BOOLEAN_INVALID',
    });
  });

  it('returns no value for an empty cell and flags error cells', () => {
    expect(parseBoolean({ kind: 'empty' })).toEqual({ ok: true, value: undefined });
    expect(parseBoolean({ kind: 'error', code: '#N/A' })).toEqual({
      ok: false,
      reason: 'CELL_ERROR_VALUE',
    });
  });
});
