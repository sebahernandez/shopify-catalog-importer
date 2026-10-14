import { COLUMNS, DATA_SHEETS, EXAMPLE_PREFIX, SHEETS } from '@importer/contracts';
import { describe, expect, it } from 'vitest';
import { checkImagePath } from '../domain/fields/image-path.js';
import { templateDefinition } from './template-content.js';

const definition = templateDefinition();
const sheet = (name: string) => {
  const found = definition.sheets.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`missing sheet ${name}`);
  return found;
};
const records = (name: string) => {
  const [header = [], ...body] = sheet(name).rows;
  return body.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])));
};
const instructions = sheet(SHEETS.instrucciones).rows.flat().join('\n');

describe('templateDefinition', () => {
  it('lists the four sheets and the contract headers in contract order', () => {
    expect(definition.sheets.map(({ name }) => name)).toEqual([...DATA_SHEETS, 'Instrucciones']);
    for (const name of DATA_SHEETS) {
      expect(sheet(name).rows[0]).toEqual(COLUMNS[name].map(({ key }) => key));
    }
  });

  it('ships exactly two EJEMPLO- products, one simple and one with consistent variants', () => {
    const keys = records('Productos').map((row) => row.product_key);
    expect(keys).toHaveLength(2);
    for (const key of keys) expect(key?.startsWith(EXAMPLE_PREFIX)).toBe(true);
    const variants = records('Variantes');
    const of = (key: string | undefined) => variants.filter((row) => row.product_key === key);
    const [simple = [], multi = []] = keys.map(of);
    expect(simple).toHaveLength(1);
    expect(simple[0]?.opcion1_nombre).toBe('');
    expect(multi.length).toBeGreaterThanOrEqual(2);
    expect(new Set(multi.map((row) => row.opcion1_nombre)).size).toBe(1);
    expect(multi[0]?.opcion1_nombre).not.toBe('');
    for (const key of keys) {
      expect(records('Imagenes').some((row) => row.product_key === key)).toBe(true);
    }
  });

  it('keeps the barcode as text and marks identifier columns as text columns', () => {
    expect(records('Variantes').some((row) => row.codigo_barras === '0123456789012')).toBe(true);
    const header = sheet('Variantes').rows[0] ?? [];
    for (const key of ['sku', 'codigo_barras', 'ubicacion']) {
      expect(sheet('Variantes').textColumns).toContain(header.indexOf(key));
    }
    expect(sheet('Variantes').trueFalseColumn).toBe(header.indexOf('gestionar_inventario'));
  });

  it('uses image paths that pass the syntax check', () => {
    for (const row of records('Imagenes')) {
      expect(checkImagePath(row.archivo ?? '').ok).toBe(true);
    }
  });

  it('explains the rules in Spanish', () => {
    for (const phrase of [
      'obligatori',
      'TRUE',
      'FALSE',
      'punto decimal',
      '4 decimales',
      'un solo código de barras',
      'separadas por comas',
      'orden',
      'EJEMPLO-',
      'formato de texto',
    ]) {
      expect(instructions).toContain(phrase);
    }
  });
});
