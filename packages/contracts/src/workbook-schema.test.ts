import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLUMNS, DATA_SHEETS, EXAMPLE_PREFIX, SHEETS } from './workbook-schema.js';

const keys = (sheet: keyof typeof COLUMNS) => COLUMNS[sheet].map((column) => column.key);
const requiredKeys = (sheet: keyof typeof COLUMNS) =>
  COLUMNS[sheet].filter((column) => column.required).map((column) => column.key);

describe('workbook schema constants', () => {
  it('exposes the three data sheets in order plus the optional instructions sheet', () => {
    expect(DATA_SHEETS).toEqual(['Productos', 'Variantes', 'Imagenes']);
    expect(SHEETS.instrucciones).toBe('Instrucciones');
  });

  it('lists the Productos columns in spec order', () => {
    expect(keys('Productos')).toEqual([
      'product_key',
      'handle',
      'titulo',
      'descripcion_html',
      'marca',
      'tipo',
      'etiquetas',
    ]);
  });

  it('lists the Variantes columns in spec order', () => {
    expect(keys('Variantes')).toEqual([
      'product_key',
      'sku',
      'precio',
      'precio_comparacion',
      'codigo_barras',
      'opcion1_nombre',
      'opcion1_valor',
      'opcion2_nombre',
      'opcion2_valor',
      'opcion3_nombre',
      'opcion3_valor',
      'gestionar_inventario',
      'stock',
      'ubicacion',
    ]);
  });

  it('lists the Imagenes columns in spec order', () => {
    expect(keys('Imagenes')).toEqual(['product_key', 'archivo', 'orden', 'alt', 'variant_sku']);
  });

  it('flags exactly the required columns', () => {
    expect(requiredKeys('Productos')).toEqual(['product_key', 'handle', 'titulo']);
    expect(requiredKeys('Variantes')).toEqual(['product_key', 'precio']);
    expect(requiredKeys('Imagenes')).toEqual(['product_key', 'archivo', 'orden']);
  });

  it('marks example rows with the EJEMPLO- prefix', () => {
    expect(EXAMPLE_PREFIX).toBe('EJEMPLO-');
  });

  it('imports no Node built-in module', () => {
    const source = readFileSync(new URL('./workbook-schema.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from\s+['"]node:/);
  });
});
