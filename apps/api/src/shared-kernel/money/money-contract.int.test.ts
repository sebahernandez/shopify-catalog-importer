import { MoneyString } from '@importer/contracts';
import { describe, expect, it } from 'vitest';
import { Money } from './money.js';

const SAMPLES = [
  '0',
  '-0',
  '-0.00',
  '000',
  '1',
  '1.50',
  '007.50',
  '12.00',
  '-12.340',
  '0.000001',
  '100',
  '12345678901234567890.123456789',
  '-9007199254740993.10',
];

describe('Money and MoneyString agree', () => {
  it.each(SAMPLES)('canonical output of %s parses under MoneyString', (input) => {
    const output = Money.parse(input).toString();
    expect(MoneyString.parse(output)).toBe(output);
  });

  it.each(SAMPLES)('JSON round trip of %s stays a string and an equal value', (input) => {
    const original = Money.parse(input);
    const wire = JSON.stringify({ price: original });
    const decoded = JSON.parse(wire) as { price: unknown };
    expect(typeof decoded.price).toBe('string');
    const price = MoneyString.parse(decoded.price);
    expect(Money.parse(price).equals(original)).toBe(true);
  });

  it('keeps a sum canonical under MoneyString', () => {
    const sum = Money.parse('0.1').add(Money.parse('0.2')).toJSON();
    expect(MoneyString.parse(sum)).toBe('0.3');
  });
});
