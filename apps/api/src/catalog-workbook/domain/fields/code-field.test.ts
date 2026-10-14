import { describe, expect, it } from 'vitest';
import { parseCode } from './code-field.js';

describe('parseCode', () => {
  it('keeps text as is, trimmed, leading zeros included', () => {
    expect(parseCode({ kind: 'text', text: '00123' })).toEqual({ ok: true, value: '00123' });
  });

  it('returns no value for an empty cell', () => {
    expect(parseCode({ kind: 'empty' })).toEqual({ ok: true, value: undefined });
  });

  it('warns about a short number cell and keeps its digits', () => {
    expect(parseCode({ kind: 'number', raw: '12345' })).toEqual({
      ok: true,
      value: '12345',
      warning: 'NUMERIC_IDENTIFIER_CELL',
    });
  });

  it('accepts exactly 15 digits with a warning', () => {
    expect(parseCode({ kind: 'number', raw: '123456789012345' })).toMatchObject({ ok: true });
  });

  it.each(['1234567890123456', '1.23457E+15', '12.5'])('blocks the number cell %s', (raw) => {
    expect(parseCode({ kind: 'number', raw })).toEqual({
      ok: false,
      reason: 'NUMERIC_IDENTIFIER_UNSAFE',
    });
  });

  it('flags error and date cells', () => {
    expect(parseCode({ kind: 'error', code: '#REF!' })).toEqual({
      ok: false,
      reason: 'CELL_ERROR_VALUE',
    });
    expect(parseCode({ kind: 'date', iso: '2026-01-01' })).toEqual({
      ok: false,
      reason: 'CELL_TYPE_UNEXPECTED',
    });
  });
});
