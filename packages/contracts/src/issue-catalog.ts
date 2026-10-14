import { z } from 'zod';

/**
 * Closed list of issue codes. This unit holds the file-level and structure codes; each rule
 * unit appends its own codes together with their param keys and Spanish entries.
 */
export const ISSUE_CODES = z.enum([
  'FILE_NOT_XLSX',
  'FILE_ENCRYPTED_OR_LEGACY',
  'FILE_UNREADABLE',
  'ZIP_TOO_MANY_ENTRIES',
  'ZIP_UNCOMPRESSED_TOO_LARGE',
  'ZIP_RATIO_EXCEEDED',
  'ZIP_UNSAFE_ENTRY_NAME',
  'ZIP_AMBIGUOUS_ARCHIVE',
  'MACROS_NOT_ALLOWED',
  'EXTERNAL_LINKS_NOT_ALLOWED',
  'EMBEDDED_CONTENT_NOT_ALLOWED',
  'FORMULA_NOT_ALLOWED',
  'SHEET_ROW_LIMIT_EXCEEDED',
  'SHEET_COLUMN_LIMIT_EXCEEDED',
  'CELL_TEXT_TOO_LONG',
  'SHEET_MISSING',
  'SHEET_DUPLICATE',
  'HEADER_MISSING',
  'HEADER_DUPLICATE',
  'HEADER_UNKNOWN',
  'HIDDEN_CONTENT',
  'CELL_ERROR_VALUE',
  'CELL_TYPE_UNEXPECTED',
  'REQUIRED_FIELD_MISSING',
  'PRODUCT_KEY_DUPLICATE',
  'HANDLE_DUPLICATE',
  'HANDLE_INVALID_FORMAT',
  'EXAMPLE_PRODUCT',
  'TAG_LIMIT_EXCEEDED',
  'SKU_MISSING',
  'SKU_DUPLICATE_IN_PRODUCT',
  'SKU_DUPLICATE_ACROSS_PRODUCTS',
  'NUMERIC_IDENTIFIER_CELL',
  'NUMERIC_IDENTIFIER_UNSAFE',
  'OPTIONS_INCONSISTENT',
  'OPTION_COMBINATION_DUPLICATE',
  'OPTION_INCOMPLETE',
  'VARIANT_COUNT_HIGH',
  'OPTION_VALUE_TOO_LONG',
  'DECIMAL_AMBIGUOUS',
  'DECIMAL_INVALID',
  'DECIMAL_SCALE_EXCEEDED',
  'DECIMAL_MAGNITUDE_EXCEEDED',
  'PRICE_NEGATIVE',
  'PRICE_ZERO',
  'COMPARE_AT_BELOW_PRICE',
  'BARCODE_MULTIPLE',
  'BOOLEAN_INVALID',
  'STOCK_INVALID',
  'INVENTORY_FLAG_REQUIRED',
]);

export type IssueCode = z.infer<typeof ISSUE_CODES>;

/** The param keys each code declares; its templates may only use these placeholders. */
export const ISSUE_PARAM_KEYS: Readonly<Record<IssueCode, readonly string[]>> = {
  FILE_NOT_XLSX: [],
  FILE_ENCRYPTED_OR_LEGACY: [],
  FILE_UNREADABLE: [],
  ZIP_TOO_MANY_ENTRIES: ['limit', 'actual'],
  ZIP_UNCOMPRESSED_TOO_LARGE: ['limit', 'actual'],
  ZIP_RATIO_EXCEEDED: ['limit', 'actual'],
  ZIP_UNSAFE_ENTRY_NAME: [],
  ZIP_AMBIGUOUS_ARCHIVE: [],
  MACROS_NOT_ALLOWED: [],
  EXTERNAL_LINKS_NOT_ALLOWED: [],
  EMBEDDED_CONTENT_NOT_ALLOWED: [],
  FORMULA_NOT_ALLOWED: [],
  SHEET_ROW_LIMIT_EXCEEDED: ['sheet', 'limit', 'actual'],
  SHEET_COLUMN_LIMIT_EXCEEDED: ['sheet', 'limit', 'actual'],
  CELL_TEXT_TOO_LONG: ['limit', 'actual'],
  SHEET_MISSING: ['sheet'],
  SHEET_DUPLICATE: ['sheet'],
  HEADER_MISSING: ['sheet', 'column'],
  HEADER_DUPLICATE: ['sheet', 'column'],
  HEADER_UNKNOWN: ['sheet', 'header'],
  HIDDEN_CONTENT: ['sheet', 'kind'],
  CELL_ERROR_VALUE: [],
  CELL_TYPE_UNEXPECTED: [],
  REQUIRED_FIELD_MISSING: ['field'],
  PRODUCT_KEY_DUPLICATE: ['firstRow'],
  HANDLE_DUPLICATE: ['firstRow'],
  HANDLE_INVALID_FORMAT: [],
  EXAMPLE_PRODUCT: [],
  TAG_LIMIT_EXCEEDED: [],
  SKU_MISSING: [],
  SKU_DUPLICATE_IN_PRODUCT: ['firstRow'],
  SKU_DUPLICATE_ACROSS_PRODUCTS: ['firstRow'],
  NUMERIC_IDENTIFIER_CELL: [],
  NUMERIC_IDENTIFIER_UNSAFE: [],
  OPTIONS_INCONSISTENT: [],
  OPTION_COMBINATION_DUPLICATE: ['firstRow'],
  OPTION_INCOMPLETE: [],
  VARIANT_COUNT_HIGH: ['count'],
  OPTION_VALUE_TOO_LONG: [],
  DECIMAL_AMBIGUOUS: [],
  DECIMAL_INVALID: [],
  DECIMAL_SCALE_EXCEEDED: [],
  DECIMAL_MAGNITUDE_EXCEEDED: [],
  PRICE_NEGATIVE: [],
  PRICE_ZERO: [],
  COMPARE_AT_BELOW_PRICE: [],
  BARCODE_MULTIPLE: [],
  BOOLEAN_INVALID: [],
  STOCK_INVALID: [],
  INVENTORY_FLAG_REQUIRED: [],
};

interface IssueTemplate {
  readonly message: string;
  readonly suggestedAction: string;
}

/** Spanish UI copy. Placeholders use `{param}` and must be declared in `ISSUE_PARAM_KEYS`. */
export const ISSUE_MESSAGES_ES: Readonly<Record<IssueCode, IssueTemplate>> = {
  FILE_NOT_XLSX: {
    message: 'El archivo no es un libro de Excel (.xlsx) válido.',
    suggestedAction: 'Descarga la plantilla, completa tus datos y súbela de nuevo como .xlsx.',
  },
  FILE_ENCRYPTED_OR_LEGACY: {
    message: 'El archivo está protegido con contraseña o usa un formato antiguo de Excel.',
    suggestedAction: 'Quita la contraseña o guarda el libro como .xlsx y súbelo de nuevo.',
  },
  FILE_UNREADABLE: {
    message: 'No se pudo leer el archivo.',
    suggestedAction: 'Vuelve a guardar el libro como .xlsx desde Excel e inténtalo de nuevo.',
  },
  ZIP_TOO_MANY_ENTRIES: {
    message:
      'El archivo contiene demasiados componentes internos (límite {limit}, encontrados {actual}).',
    suggestedAction: 'Usa la plantilla sin agregar objetos, imágenes ni hojas adicionales.',
  },
  ZIP_UNCOMPRESSED_TOO_LARGE: {
    message:
      'El contenido del archivo es demasiado grande al descomprimirlo (límite {limit} bytes, encontrados {actual}).',
    suggestedAction:
      'Reduce el tamaño del libro y elimina el contenido que no sea de la plantilla.',
  },
  ZIP_RATIO_EXCEEDED: {
    message:
      'El archivo tiene una relación de compresión sospechosa (límite {limit}:1, encontrada {actual}:1).',
    suggestedAction: 'Genera el libro de nuevo desde la plantilla y guárdalo como .xlsx.',
  },
  ZIP_UNSAFE_ENTRY_NAME: {
    message: 'El archivo contiene componentes con nombres no seguros.',
    suggestedAction: 'Genera el libro de nuevo desde la plantilla y guárdalo como .xlsx.',
  },
  ZIP_AMBIGUOUS_ARCHIVE: {
    message: 'La estructura interna del archivo es ambigua o está dañada.',
    suggestedAction: 'Genera el libro de nuevo desde la plantilla y guárdalo como .xlsx.',
  },
  MACROS_NOT_ALLOWED: {
    message: 'El libro contiene macros, que no están permitidas.',
    suggestedAction: 'Elimina las macros y guarda el libro como .xlsx.',
  },
  EXTERNAL_LINKS_NOT_ALLOWED: {
    message: 'El libro contiene vínculos a archivos externos, que no están permitidos.',
    suggestedAction: 'Elimina los vínculos externos y reemplázalos por valores.',
  },
  EMBEDDED_CONTENT_NOT_ALLOWED: {
    message: 'El libro contiene objetos incrustados, que no están permitidos.',
    suggestedAction: 'Elimina los objetos incrustados y deja solo datos en las hojas.',
  },
  FORMULA_NOT_ALLOWED: {
    message: 'La celda contiene una fórmula, que no está permitida.',
    suggestedAction: 'Reemplaza la fórmula por su valor como texto o número.',
  },
  SHEET_ROW_LIMIT_EXCEEDED: {
    message: 'La hoja {sheet} supera el límite de filas (límite {limit}, encontradas {actual}).',
    suggestedAction: 'Divide el catálogo en varios libros más pequeños.',
  },
  SHEET_COLUMN_LIMIT_EXCEEDED: {
    message: 'La hoja {sheet} supera el límite de columnas (límite {limit}, encontradas {actual}).',
    suggestedAction: 'Elimina las columnas que no pertenecen a la plantilla.',
  },
  CELL_TEXT_TOO_LONG: {
    message:
      'El texto de la celda es demasiado largo (límite {limit} caracteres, encontrados {actual}).',
    suggestedAction: 'Acorta el texto de la celda.',
  },
  SHEET_MISSING: {
    message: 'Falta la hoja {sheet}.',
    suggestedAction: 'Agrega la hoja {sheet} con el nombre exacto de la plantilla.',
  },
  SHEET_DUPLICATE: {
    message: 'Hay más de una hoja que corresponde a {sheet}.',
    suggestedAction: 'Deja una sola hoja {sheet} y elimina o renombra las demás.',
  },
  HEADER_MISSING: {
    message: 'Falta la columna obligatoria {column} en la hoja {sheet}.',
    suggestedAction: 'Agrega la columna {column} en la primera fila de la hoja {sheet}.',
  },
  HEADER_DUPLICATE: {
    message: 'La columna {column} aparece más de una vez en la hoja {sheet}.',
    suggestedAction: 'Deja una sola columna {column} en la hoja {sheet}.',
  },
  HEADER_UNKNOWN: {
    message: 'La columna {header} de la hoja {sheet} no se reconoce y se ignorará.',
    suggestedAction: 'Elimina la columna {header} o revisa que el nombre sea el de la plantilla.',
  },
  HIDDEN_CONTENT: {
    message: 'La hoja {sheet} tiene contenido oculto con datos ({kind}).',
    suggestedAction: 'Muestra el contenido oculto y revisa que sea correcto.',
  },
  CELL_ERROR_VALUE: {
    message: 'La celda contiene un valor de error de Excel.',
    suggestedAction: 'Corrige el error de la celda y escribe el valor correcto.',
  },
  CELL_TYPE_UNEXPECTED: {
    message: 'El tipo de dato de la celda no es válido para esta columna.',
    suggestedAction: 'Escribe en la celda un texto o un número, según corresponda a la columna.',
  },
  REQUIRED_FIELD_MISSING: {
    message: 'Falta un valor obligatorio en la columna {field}.',
    suggestedAction: 'Completa la columna {field} en esta fila.',
  },
  PRODUCT_KEY_DUPLICATE: {
    message: 'El product_key ya se usó en la fila {firstRow}.',
    suggestedAction: 'Usa un product_key distinto para cada producto.',
  },
  HANDLE_DUPLICATE: {
    message:
      'El handle ya se usó en la fila {firstRow} (no se distingue entre mayúsculas y minúsculas).',
    suggestedAction: 'Usa un handle distinto para cada producto.',
  },
  HANDLE_INVALID_FORMAT: {
    message: 'El handle solo puede tener letras, números y guiones, sin espacios.',
    suggestedAction: 'Corrige el handle, por ejemplo camisa-roja-2.',
  },
  EXAMPLE_PRODUCT: {
    message: 'Este producto es un ejemplo de la plantilla.',
    suggestedAction: 'Elimina las filas de ejemplo antes de importar tu catálogo.',
  },
  TAG_LIMIT_EXCEEDED: {
    message:
      'Las etiquetas superan el límite: más de 250 etiquetas o alguna de más de 255 caracteres.',
    suggestedAction: 'Reduce la cantidad de etiquetas o acorta las más largas.',
  },
  SKU_MISSING: {
    message: 'Esta variante no tiene SKU.',
    suggestedAction: 'Completa el sku si lo necesitas para identificar la variante.',
  },
  SKU_DUPLICATE_IN_PRODUCT: {
    message: 'El sku ya se usó en la fila {firstRow} para el mismo producto.',
    suggestedAction: 'Usa un sku distinto para cada variante del producto.',
  },
  SKU_DUPLICATE_ACROSS_PRODUCTS: {
    message: 'El sku ya se usó en la fila {firstRow} en otro producto.',
    suggestedAction: 'Revisa que repetir el sku entre productos sea intencional.',
  },
  NUMERIC_IDENTIFIER_CELL: {
    message: 'La celda es numérica; si el código empezaba con ceros, Excel pudo haberlos perdido.',
    suggestedAction: 'Da formato de texto a la columna y vuelve a escribir el código completo.',
  },
  NUMERIC_IDENTIFIER_UNSAFE: {
    message: 'La celda numérica tiene 16 o más dígitos o está en notación científica.',
    suggestedAction: 'Da formato de texto a la columna y vuelve a escribir el código completo.',
  },
  OPTIONS_INCONSISTENT: {
    message:
      'Las opciones de esta variante no coinciden con las de las demás variantes del producto.',
    suggestedAction:
      'Usa los mismos nombres de opción en las mismas posiciones en todas las variantes del producto.',
  },
  OPTION_COMBINATION_DUPLICATE: {
    message: 'Esta combinación de valores de opción ya se usó en la fila {firstRow}.',
    suggestedAction: 'Cambia algún valor para que cada variante tenga una combinación distinta.',
  },
  OPTION_INCOMPLETE: {
    message: 'Una opción tiene nombre sin valor, o valor sin nombre.',
    suggestedAction: 'Completa el nombre y el valor de la opción, o deja ambos vacíos.',
  },
  VARIANT_COUNT_HIGH: {
    message: 'El producto tiene {count} variantes, más de las 250 recomendadas.',
    suggestedAction: 'Revisa si conviene dividir el producto en varios.',
  },
  OPTION_VALUE_TOO_LONG: {
    message: 'El valor de la opción supera los 255 caracteres.',
    suggestedAction: 'Acorta el valor de la opción.',
  },
  DECIMAL_AMBIGUOUS: {
    message:
      'El número usa coma o separadores de miles, por lo que no se puede interpretar con certeza.',
    suggestedAction:
      'Escribe el número con punto decimal y sin separadores de miles, por ejemplo 1999.99.',
  },
  DECIMAL_INVALID: {
    message: 'El valor no es un número decimal válido.',
    suggestedAction:
      'Escribe solo dígitos con punto decimal opcional, sin texto ni notación científica.',
  },
  DECIMAL_SCALE_EXCEEDED: {
    message: 'El número tiene más de 4 decimales.',
    suggestedAction: 'Reduce el número a un máximo de 4 decimales.',
  },
  DECIMAL_MAGNITUDE_EXCEEDED: {
    message: 'El número es demasiado grande: debe ser menor que 1000000000000.',
    suggestedAction: 'Escribe un valor menor que 1000000000000.',
  },
  PRICE_NEGATIVE: {
    message: 'El monto no puede ser negativo.',
    suggestedAction: 'Escribe un monto igual o mayor que cero.',
  },
  PRICE_ZERO: {
    message: 'El precio es cero.',
    suggestedAction: 'Confirma que la variante debe venderse a precio cero.',
  },
  COMPARE_AT_BELOW_PRICE: {
    message: 'El precio de comparación es menor que el precio.',
    suggestedAction: 'Usa un precio de comparación mayor que el precio, o déjalo vacío.',
  },
  BARCODE_MULTIPLE: {
    message: 'La celda contiene más de un código de barras.',
    suggestedAction: 'Deja un solo código de barras por variante.',
  },
  BOOLEAN_INVALID: {
    message: 'El valor no es un sí o no reconocido.',
    suggestedAction: 'Escribe verdadero, falso, sí, no, true, false, 1 o 0.',
  },
  STOCK_INVALID: {
    message: 'El stock debe ser un número entero igual o mayor que cero.',
    suggestedAction:
      'Escribe una cantidad entera sin decimales ni texto; es obligatoria si se gestiona inventario.',
  },
  INVENTORY_FLAG_REQUIRED: {
    message: 'Hay stock, pero la columna gestionar_inventario está vacía.',
    suggestedAction:
      'Indica en gestionar_inventario si se gestiona el inventario de esta variante.',
  },
};

/** Renders the Spanish message and suggested action for a code. Pure: same input, same text. */
export function renderIssue(
  code: IssueCode,
  params: Readonly<Record<string, string | number | boolean>>,
): IssueTemplate {
  // Single pass over the template, so braces inside a param value are never expanded again.
  const fill = (template: string): string =>
    template.replace(/\{(\w+)\}/g, (_match, key: string) =>
      ISSUE_PARAM_KEYS[code].includes(key) && key in params ? String(params[key]) : '',
    );
  const { message, suggestedAction } = ISSUE_MESSAGES_ES[code];
  return { message: fill(message), suggestedAction: fill(suggestedAction) };
}
