import { describe, expect, it } from 'vitest';
import { parseBarcode } from './barcode-field.js';

const text = (value: string) => ({ kind: 'text', text: value }) as const;

describe('parseBarcode', () => {
  it('accepts one barcode and keeps leading zeros', () => {
    expect(parseBarcode(text('0075010001'))).toEqual({ ok: true, value: '0075010001' });
  });

  it.each(['7501,7502', '7501;7502', '7501|7502', '7501\n7502', '7501 7502'])(
    'rejects several barcodes in %j',
    (input) => {
      expect(parseBarcode(text(input))).toEqual({ ok: false, reason: 'BARCODE_MULTIPLE' });
    },
  );

  it('applies the identifier rules to number cells', () => {
    expect(parseBarcode({ kind: 'number', raw: '12345' })).toMatchObject({
      ok: true,
      warning: 'NUMERIC_IDENTIFIER_CELL',
    });
    expect(parseBarcode({ kind: 'number', raw: '1.23457E+15' })).toEqual({
      ok: false,
      reason: 'NUMERIC_IDENTIFIER_UNSAFE',
    });
  });
});
