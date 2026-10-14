import { describe, expect, it } from 'vitest';
import { matchKey } from './match-key.js';

describe('matchKey', () => {
  it('matches accented and padded sheet names', () => {
    expect(matchKey('  Imágenes ')).toBe(matchKey('Imagenes'));
  });

  it('folds case and accents', () => {
    expect(matchKey('TÍTULO')).toBe('titulo');
    expect(matchKey(' Product_Key ')).toBe('product_key');
  });
});
