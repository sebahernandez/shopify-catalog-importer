import { describe, expect, it } from 'vitest';
import type { FieldValue } from '../workbook-cell.js';
import { parseDecimal } from './decimal-field.js';

const text = (value: string): FieldValue => ({ kind: 'text', text: value });
const number = (raw: string): FieldValue => ({ kind: 'number', raw });

describe('parseDecimal', () => {
  it('accepts four decimal places', () => {
    const result = parseDecimal(text('1999.9999'));
    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.value?.toString()).toBe('1999.9999');
  });

  it('reads a number cell from its stored text', () => {
    const result = parseDecimal(number('0.1'));
    expect(result.ok && result.value?.toString()).toBe('0.1');
  });

  it('returns no value for an empty cell', () => {
    expect(parseDecimal({ kind: 'empty' })).toEqual({ ok: true, value: undefined });
  });

  it.each([
    ['19,99', 'DECIMAL_AMBIGUOUS'],
    ['1.12345', 'DECIMAL_SCALE_EXCEEDED'],
    ['1000000000000', 'DECIMAL_MAGNITUDE_EXCEEDED'],
    ['-1', 'PRICE_NEGATIVE'],
    ['1E+5', 'DECIMAL_INVALID'],
    ['abc', 'DECIMAL_INVALID'],
  ])('rejects %s with %s', (input, reason) => {
    expect(parseDecimal(text(input))).toEqual({ ok: false, reason });
  });

  it('never rounds a float artifact', () => {
    expect(parseDecimal(number('19.989999999999998'))).toEqual({
      ok: false,
      reason: 'DECIMAL_SCALE_EXCEEDED',
    });
  });

  it('rejects an exponent number cell', () => {
    expect(parseDecimal(number('1.5E+3'))).toEqual({ ok: false, reason: 'DECIMAL_INVALID' });
  });

  it('warns about zero but keeps the value', () => {
    const result = parseDecimal(text('0'));
    expect(result).toMatchObject({ ok: true, warning: 'PRICE_ZERO' });
  });

  it('flags error, date and boolean cells', () => {
    expect(parseDecimal({ kind: 'error', code: '#N/A' })).toEqual({
      ok: false,
      reason: 'CELL_ERROR_VALUE',
    });
    expect(parseDecimal({ kind: 'date', iso: '2026-01-01' })).toEqual({
      ok: false,
      reason: 'CELL_TYPE_UNEXPECTED',
    });
    expect(parseDecimal({ kind: 'boolean', value: true })).toEqual({
      ok: false,
      reason: 'CELL_TYPE_UNEXPECTED',
    });
  });
});
