import {
  readBoundedBody,
  UploadRejection,
  type BoundedBody,
  type BodySource,
} from './bounded-body-reader.js';

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const UPLOAD_TYPES: ReadonlySet<string> = new Set([XLSX_TYPE, 'application/octet-stream']);

/**
 * Reads the raw xlsx body of an upload route: the content type must be xlsx or octet-stream (a
 * missing type counts as octet-stream, RFC 9110, so an empty request is 400 and not 415) and the
 * body is read with the bounded reader. Shared by every route that takes a workbook.
 */
export async function readWorkbookUpload(
  request: BodySource,
  maxBytes: number,
): Promise<BoundedBody> {
  const type = request.headers['content-type']?.split(';')[0]?.trim().toLowerCase();
  if (type !== undefined && !UPLOAD_TYPES.has(type)) {
    throw new UploadRejection('WORKBOOK_UNSUPPORTED_MEDIA_TYPE', true);
  }
  return readBoundedBody(request, maxBytes);
}
