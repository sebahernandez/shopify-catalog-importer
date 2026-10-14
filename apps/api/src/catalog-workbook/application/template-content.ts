import { COLUMNS, DATA_SHEETS, SHEETS, type DataSheet } from '@importer/contracts';
import type { TemplateDefinition, TemplateSheet } from '../ports/template-writer.port.js';

const headerOf = (sheet: DataSheet): string[] => COLUMNS[sheet].map(({ key }) => key);

/** Builds a row in contract order from the named values; a column left out stays empty. */
const rowOf = (sheet: DataSheet, values: Readonly<Record<string, string>>): string[] =>
  headerOf(sheet).map((key) => values[key] ?? '');

const productos = (): string[][] => [
  headerOf('Productos'),
  rowOf('Productos', {
    product_key: 'EJEMPLO-GORRA',
    handle: 'ejemplo-gorra',
    titulo: 'Gorra de ejemplo',
    descripcion_html: '<p>Producto simple de ejemplo</p>',
    marca: 'Marca Ejemplo',
    tipo: 'Accesorios',
    etiquetas: 'ejemplo, gorra',
  }),
  rowOf('Productos', {
    product_key: 'EJEMPLO-REMERA',
    handle: 'ejemplo-remera',
    titulo: 'Remera de ejemplo',
    descripcion_html: '<p>Producto con opciones de ejemplo</p>',
    marca: 'Marca Ejemplo',
    tipo: 'Ropa',
    etiquetas: 'ejemplo, remera',
  }),
];

const variantes = (): string[][] => [
  headerOf('Variantes'),
  rowOf('Variantes', {
    product_key: 'EJEMPLO-GORRA',
    sku: '0001',
    precio: '12.50',
    codigo_barras: '0123456789012',
    gestionar_inventario: 'TRUE',
    stock: '10',
    ubicacion: 'Bodega',
  }),
  ...['S', 'M'].map((talla) =>
    rowOf('Variantes', {
      product_key: 'EJEMPLO-REMERA',
      sku: `0002-${talla}`,
      precio: '19.90',
      precio_comparacion: '24.90',
      opcion1_nombre: 'Talla',
      opcion1_valor: talla,
      gestionar_inventario: 'FALSE',
    }),
  ),
];

const imagenes = (): string[][] => [
  headerOf('Imagenes'),
  rowOf('Imagenes', {
    product_key: 'EJEMPLO-GORRA',
    archivo: 'ejemplo/gorra.jpg',
    orden: '1',
    alt: 'Gorra de ejemplo',
  }),
  rowOf('Imagenes', {
    product_key: 'EJEMPLO-REMERA',
    archivo: 'ejemplo/remera.jpg',
    orden: '1',
    alt: 'Remera de ejemplo',
  }),
];

const INSTRUCTIONS = [
  'Complete las hojas Productos, Variantes e Imagenes. Cada producto se identifica con su product_key, que debe repetirse igual en las tres hojas.',
  'Campos obligatorios: product_key, handle y titulo en Productos; product_key y precio en Variantes; product_key, archivo y orden en Imagenes.',
  'Los valores verdadero o falso se escriben TRUE o FALSE (también se aceptan true, false, 1 y 0).',
  'Los precios usan punto decimal y como máximo 4 decimales, por ejemplo 12.50.',
  'Cada variante admite un solo código de barras en codigo_barras.',
  'Las etiquetas van en una sola celda, separadas por comas.',
  'En Imagenes, orden es un número entero positivo; la imagen con orden 1 es la principal.',
  'Las filas cuyo product_key empieza con EJEMPLO- son ejemplos: elimínelas antes de importar.',
  'Las columnas sku, codigo_barras y ubicacion usan formato de texto para conservar los ceros iniciales. Si su programa no permite el formato de texto, escriba esos valores como texto (por ejemplo con un apóstrofo inicial); el validador rechaza los números en esas columnas.',
];

const instrucciones = (): string[][] => [['Guía de uso'], ...INSTRUCTIONS.map((line) => [line])];

const textColumnsOf = (sheet: DataSheet, keys: readonly string[]): number[] =>
  keys.map((key) => headerOf(sheet).indexOf(key));

/** The fixed template: contract headers, two `EJEMPLO-` products and the Spanish instructions. */
export function templateDefinition(): TemplateDefinition {
  const data: Record<DataSheet, TemplateSheet> = {
    Productos: {
      name: SHEETS.productos,
      rows: productos(),
      widths: [18, 18, 28, 36, 18, 14, 22],
    },
    Variantes: {
      name: SHEETS.variantes,
      rows: variantes(),
      textColumns: textColumnsOf('Variantes', ['sku', 'codigo_barras', 'ubicacion']),
      widths: [18, 14, 10, 18, 18, 16, 16, 16, 16, 16, 16, 22, 10, 16],
      trueFalseColumn: headerOf('Variantes').indexOf('gestionar_inventario'),
    },
    Imagenes: {
      name: SHEETS.imagenes,
      rows: imagenes(),
      widths: [18, 30, 8, 28, 16],
    },
  };
  return {
    sheets: [
      ...DATA_SHEETS.map((name) => data[name]),
      { name: SHEETS.instrucciones, rows: instrucciones(), widths: [120] },
    ],
  };
}
