import { ImportResponse, ValidationReport } from '@importer/contracts';
import { request, type ApiResult, type ClientOptions } from './request';

export const VALIDATE_PATH = '/api/workbook/validate';
export const TEMPLATE_PATH = '/api/workbook/template';
export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The import is one long request: the API answers only when every product has been tried. */
export const IMPORT_TIMEOUT_MS = 30 * 60 * 1000;

const FILE_HEADERS = { 'content-type': XLSX_CONTENT_TYPE };

export const importPath = (storeId: string): string =>
  `/api/stores/${encodeURIComponent(storeId)}/import`;

/** The body is the file itself, not multipart. */
export function validateWorkbook(
  file: Blob,
  options: ClientOptions = {},
): Promise<ApiResult<ValidationReport>> {
  return request(options, {
    method: 'POST',
    path: VALIDATE_PATH,
    headers: FILE_HEADERS,
    body: file,
    reply: { as: 'json', parser: ValidationReport },
  });
}

export function downloadTemplate(options: ClientOptions = {}): Promise<ApiResult<Blob>> {
  return request(options, { method: 'GET', path: TEMPLATE_PATH, reply: { as: 'blob' } });
}

export function importCatalog(
  storeId: string,
  file: Blob,
  options: ClientOptions = {},
): Promise<ApiResult<ImportResponse>> {
  return request(
    { timeoutMs: IMPORT_TIMEOUT_MS, ...options },
    {
      method: 'POST',
      path: importPath(storeId),
      headers: FILE_HEADERS,
      body: file,
      reply: { as: 'json', parser: ImportResponse },
    },
  );
}
