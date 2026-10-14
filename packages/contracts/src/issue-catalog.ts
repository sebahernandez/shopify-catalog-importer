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
