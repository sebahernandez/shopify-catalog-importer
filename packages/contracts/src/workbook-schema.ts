/** Sheet names of the catalog workbook, as canonical (unaccented, trimmed) text. */
export const SHEETS = {
  productos: 'Productos',
  variantes: 'Variantes',
  imagenes: 'Imagenes',
  instrucciones: 'Instrucciones',
} as const;

/** The data sheets, in workbook order. `Instrucciones` is optional and never validated. */
export const DATA_SHEETS = [SHEETS.productos, SHEETS.variantes, SHEETS.imagenes] as const;

export type DataSheet = (typeof DATA_SHEETS)[number];

export interface WorkbookColumn {
  readonly key: string;
  readonly required: boolean;
}

const required = (key: string): WorkbookColumn => ({ key, required: true });
const optional = (key: string): WorkbookColumn => ({ key, required: false });

/** Ordered columns of each data sheet; matching is order-independent, this order is the template's. */
export const COLUMNS: Readonly<Record<DataSheet, readonly WorkbookColumn[]>> = {
  Productos: [
    required('product_key'),
    required('handle'),
    required('titulo'),
    optional('descripcion_html'),
    optional('marca'),
    optional('tipo'),
    optional('etiquetas'),
  ],
  Variantes: [
    required('product_key'),
    optional('sku'),
    required('precio'),
    optional('precio_comparacion'),
    optional('codigo_barras'),
    optional('opcion1_nombre'),
    optional('opcion1_valor'),
    optional('opcion2_nombre'),
    optional('opcion2_valor'),
    optional('opcion3_nombre'),
    optional('opcion3_valor'),
    optional('gestionar_inventario'),
    optional('stock'),
    optional('ubicacion'),
  ],
  Imagenes: [
    required('product_key'),
    required('archivo'),
    required('orden'),
    optional('alt'),
    optional('variant_sku'),
  ],
};

/** Prefix that marks the template's example rows. */
export const EXAMPLE_PREFIX = 'EJEMPLO-';
