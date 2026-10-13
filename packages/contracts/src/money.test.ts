import { describe, expect, it } from 'vitest';
import { MoneyString } from './money.js';

describe('MoneyString', () => {
  it.each([
    '0',
    '1',
    '7.5',
    '-7.5',
    '100',
    '0.001',
    '10.05',
    '12345678901234567890.123456789',
    '-0.1',
  ])('accepts the canonical form %s', (value) => {
    expect(MoneyString.parse(value)).toBe(value);
  });

  it.each([
    ['trailing fraction zero', '1.50'],
    ['empty fraction', '12.'],
    ['leading zero', '007.5'],
    ['negative zero', '-0'],
    ['negative zero fraction', '-0.0'],
    ['zero with fraction zeros', '0.00'],
    ['plus sign', '+1'],
    ['comma', '1,5'],
    ['leading dot', '.5'],
    ['exponent', '1e3'],
    ['whitespace', ' 1'],
    ['empty string', ''],
    ['letters', 'abc'],
    ['two dots', '1.2.3'],
    ['non-ASCII digits', '١٢٣'],
  ])('rejects %s (%j)', (_label, value) => {
    expect(MoneyString.safeParse(value).success).toBe(false);
  });

  it.each([
    ['a number', 1.5],
    ['zero as a number', 0],
    ['null', null],
    ['an object', { amount: '1' }],
  ])('rejects %s', (_label, value) => {
    expect(MoneyString.safeParse(value).success).toBe(false);
  });
});
