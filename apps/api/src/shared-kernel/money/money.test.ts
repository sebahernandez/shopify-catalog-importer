import { describe, expect, it } from 'vitest';
import { Money, MoneyError } from './money.js';

const CANONICAL = /^-?(0|[1-9][0-9]*)(\.[0-9]*[1-9])?$/;

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof MoneyError ? error.code : `not a MoneyError: ${String(error)}`;
  }
  return undefined;
}

describe('Money.parse canonical form', () => {
  it.each([
    ['0', '0'],
    ['1', '1'],
    ['1.5', '1.5'],
    ['007.50', '7.5'],
    ['12.00', '12'],
    ['0.10', '0.1'],
    ['000', '0'],
    ['0.000', '0'],
    ['-0', '0'],
    ['-0.00', '0'],
    ['-007.50', '-7.5'],
    ['-12.340', '-12.34'],
    ['100', '100'],
    ['100.0', '100'],
  ])('parses %s to %s', (input, expected) => {
    expect(Money.parse(input).toString()).toBe(expected);
  });

  it('preserves every digit of a long value', () => {
    const input = '12345678901234567890.123456789';
    expect(Money.parse(input).toString()).toBe(input);
  });

  it('handles values far beyond Number.MAX_SAFE_INTEGER', () => {
    const input = '9007199254740993123456789.000000000000000000000001';
    expect(Money.parse(input).toString()).toBe(input);
  });

  it('reports the significant scale', () => {
    expect(Money.parse('7.50').scale).toBe(1);
    expect(Money.parse('12.00').scale).toBe(0);
    expect(Money.parse('0.000123').scale).toBe(6);
  });

  it('gives identical output for equal values', () => {
    expect(Money.parse('1.50').toString()).toBe(Money.parse('1.5').toString());
  });

  it('produces output that always matches the canonical grammar', () => {
    for (const input of ['0', '-0.00', '007.50', '1.10', '123456789.987654321', '-9.0']) {
      expect(Money.parse(input).toString()).toMatch(CANONICAL);
    }
  });
});

describe('Money.parse rejection', () => {
  it.each(['1,234', '1.234,56', '12,50', ',5', '1,'])(
    'flags %j as an ambiguous separator',
    (input) => {
      expect(codeOf(() => Money.parse(input))).toBe('AMBIGUOUS_SEPARATOR');
    },
  );

  it.each([
    ['empty', ''],
    ['two dots', '1.2.3'],
    ['exponent', '1e3'],
    ['letters', 'abc'],
    ['NaN literal', 'NaN'],
    ['Infinity literal', 'Infinity'],
    ['negative Infinity literal', '-Infinity'],
    ['plus sign', '+1'],
    ['leading dot', '.5'],
    ['trailing dot', '5.'],
    ['lone dot', '.'],
    ['lone minus', '-'],
    ['double minus', '--1'],
    ['leading space', ' 1'],
    ['trailing space', '1 '],
    ['inner space', '1 000'],
    ['only whitespace', '   '],
    ['newline', '1\n'],
    ['tab', '\t1'],
    ['currency symbol', '$1'],
    ['arabic-indic digits', '١٢٣'],
    ['fullwidth digits', '１２３'],
    ['hex', '0x10'],
  ])('rejects %s (%j) as an invalid format', (_label, input) => {
    expect(codeOf(() => Money.parse(input))).toBe('INVALID_FORMAT');
  });

  it('keeps the ambiguity error distinct from a format error', () => {
    expect(codeOf(() => Money.parse('1,234'))).not.toBe(codeOf(() => Money.parse('1.2.3')));
  });

  it.each([
    ['a JS number', 0.1],
    ['zero as a number', 0],
    ['a bigint', 10n],
    ['null', null],
    ['undefined', undefined],
    ['an object', {}],
  ])('rejects %s as an invalid format', (_label, input) => {
    expect(codeOf(() => Money.parse(input as string))).toBe('INVALID_FORMAT');
  });

  it('never echoes a rejected input in the error message', () => {
    try {
      Money.parse('secret-9999');
      expect.unreachable('parse should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(MoneyError);
      expect((error as MoneyError).message).not.toContain('secret-9999');
    }
  });
});

describe('Money.tryParse', () => {
  it('returns the value for valid input', () => {
    const result = Money.tryParse('007.50');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.toString()).toBe('7.5');
    }
  });

  it('returns the error code for a comma', () => {
    const result = Money.tryParse('1,234');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('AMBIGUOUS_SEPARATOR');
    }
  });

  it('returns INVALID_FORMAT for a JS number without throwing', () => {
    const result = Money.tryParse(0.1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_FORMAT');
    }
  });
});

describe('Money arithmetic and comparison', () => {
  it('adds 0.1 and 0.2 to exactly 0.3', () => {
    const sum = Money.parse('0.1').add(Money.parse('0.2'));
    expect(sum.toString()).toBe('0.3');
    // The float sum is inexact; this guards against any float conversion.
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it.each([
    ['1.5', '2.25', '3.75'],
    ['999999999999999999.99', '0.01', '1000000000000000000'],
    ['-1.5', '1.5', '0'],
    ['-0.3', '-0.7', '-1'],
    ['9007199254740993', '1', '9007199254740994'],
    ['1', '0.000000000000000000000001', '1.000000000000000000000001'],
  ])('adds %s and %s to %s', (a, b, expected) => {
    expect(Money.parse(a).add(Money.parse(b)).toString()).toBe(expected);
  });

  it('is commutative', () => {
    const a = Money.parse('12.345');
    const b = Money.parse('-0.0005');
    expect(a.add(b).toString()).toBe(b.add(a).toString());
  });

  it('returns a new instance and leaves the operands unchanged', () => {
    const a = Money.parse('1.5');
    const b = Money.parse('2.25');
    const sum = a.add(b);
    expect(sum).not.toBe(a);
    expect(sum).not.toBe(b);
    expect(a.toString()).toBe('1.5');
    expect(b.toString()).toBe('2.25');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(Money.parse('1.5'))).toBe(true);
  });

  it('treats 1.50 and 1.5 as equal', () => {
    expect(Money.parse('1.50').equals(Money.parse('1.5'))).toBe(true);
  });

  it('treats negative zero as equal to zero', () => {
    expect(Money.parse('-0.00').equals(Money.parse('0'))).toBe(true);
  });

  it('treats different values as not equal', () => {
    expect(Money.parse('1.5').equals(Money.parse('1.05'))).toBe(false);
  });

  it.each([
    ['1', '2', -1],
    ['2', '1', 1],
    ['1.50', '1.5', 0],
    ['0.10', '0.2', -1],
    ['-1', '-2', 1],
    ['-1', '1', -1],
    ['10', '9.99', 1],
    ['9007199254740993', '9007199254740992', 1],
  ])('compares %s with %s as %i', (a, b, expected) => {
    expect(Money.parse(a).compare(Money.parse(b))).toBe(expected);
  });

  it('reports the sign', () => {
    expect(Money.parse('-0.01').isNegative()).toBe(true);
    expect(Money.parse('0.01').isNegative()).toBe(false);
    expect(Money.parse('-0').isNegative()).toBe(false);
  });
});

describe('Money.toFixed', () => {
  it.each([
    ['1.5', 2, '1.50'],
    ['12', 2, '12.00'],
    ['12', 0, '12'],
    ['0', 3, '0.000'],
    ['-0.5', 2, '-0.50'],
    ['0.05', 2, '0.05'],
    ['12345678901234567890.1', 3, '12345678901234567890.100'],
  ])('pads %s to %i places as %s', (input, places, expected) => {
    expect(Money.parse(input).toFixed(places)).toBe(expected);
  });

  it('throws when the significant scale exceeds the requested places', () => {
    expect(codeOf(() => Money.parse('1.234').toFixed(2))).toBe('SCALE_EXCEEDED');
  });

  it('does not throw when only trailing zeros would be dropped', () => {
    expect(Money.parse('1.230').toFixed(2)).toBe('1.23');
  });

  it.each([-1, 1.5, Number.NaN])('rejects %s as a scale', (places) => {
    expect(codeOf(() => Money.parse('1').toFixed(places))).toBe('INVALID_SCALE');
  });
});

describe('Money serialization', () => {
  it('toJSON returns the canonical string', () => {
    const json = Money.parse('007.50').toJSON();
    expect(typeof json).toBe('string');
    expect(json).toBe('7.5');
  });

  it('serializes to a JSON string, never a number', () => {
    const encoded = JSON.stringify({ price: Money.parse('19.90') });
    expect(encoded).toBe('{"price":"19.9"}');
  });

  it('round trips through JSON to an equal value', () => {
    const original = Money.parse('12345678901234567890.123456789');
    const decoded = JSON.parse(JSON.stringify({ price: original })) as { price: string };
    expect(typeof decoded.price).toBe('string');
    expect(Money.parse(decoded.price).equals(original)).toBe(true);
  });
});
