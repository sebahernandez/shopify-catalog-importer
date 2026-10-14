export type ImagePathReason =
  | 'IMAGE_PATH_EMPTY'
  | 'IMAGE_PATH_ABSOLUTE'
  | 'IMAGE_PATH_TRAVERSAL'
  | 'IMAGE_PATH_URL'
  | 'IMAGE_PATH_CONTROL_CHARS'
  | 'IMAGE_PATH_NO_FILENAME';

export type ImagePathResult = { ok: true; path: string } | { ok: false; reason: ImagePathReason };

// eslint-disable-next-line no-control-regex -- the point of the check is to find control characters
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const URL_SCHEME = /^[a-z][a-z0-9+.-]+:/i;
const DRIVE = /^[a-z]:/i;

/**
 * Syntax check only, with no file-system access. Slash and backslash both separate segments. The
 * result is the trimmed relative path with `/` separators.
 */
export function checkImagePath(input: string): ImagePathResult {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { ok: false, reason: 'IMAGE_PATH_EMPTY' };
  }
  if (CONTROL_CHARS.test(trimmed)) {
    return { ok: false, reason: 'IMAGE_PATH_CONTROL_CHARS' };
  }
  if (URL_SCHEME.test(trimmed)) {
    return { ok: false, reason: 'IMAGE_PATH_URL' };
  }
  const path = trimmed.replaceAll('\\', '/');
  if (path.startsWith('/') || DRIVE.test(path)) {
    return { ok: false, reason: 'IMAGE_PATH_ABSOLUTE' };
  }
  if (path.split('/').includes('..')) {
    return { ok: false, reason: 'IMAGE_PATH_TRAVERSAL' };
  }
  if (path.endsWith('/')) {
    return { ok: false, reason: 'IMAGE_PATH_NO_FILENAME' };
  }
  return { ok: true, path };
}
