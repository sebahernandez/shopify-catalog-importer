export type ImagePathReason =
  | 'IMAGE_PATH_EMPTY'
  | 'IMAGE_PATH_ABSOLUTE'
  | 'IMAGE_PATH_TRAVERSAL'
  | 'IMAGE_PATH_URL_SCHEME'
  | 'IMAGE_PATH_URL_INVALID'
  | 'IMAGE_PATH_URL_CREDENTIALS'
  | 'IMAGE_PATH_URL_TOO_LONG'
  | 'IMAGE_PATH_CONTROL_CHARS'
  | 'IMAGE_PATH_NO_FILENAME';

/** `url`: an absolute http(s) URL, kept as written. `local`: a relative path with `/` separators. */
export type ImageSourceKind = 'url' | 'local';

export type ImagePathResult =
  { ok: true; path: string; kind: ImageSourceKind } | { ok: false; reason: ImagePathReason };

/** Longest accepted image URL, in characters. */
export const MAX_IMAGE_URL_CHARS = 2048;

// eslint-disable-next-line no-control-regex -- the point of the check is to find control characters
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const HTTP_URL = /^https?:\/\//i;
const URL_SCHEME = /^[a-z][a-z0-9+.-]+:/i;
/** The WHATWG parser silently repairs `https:///host`; a real authority must follow the `//`. */
const AUTHORITY_FOLLOWS = /^https?:\/\/[^/?#\\]/i;
const WHITESPACE = /\s/;
const DRIVE = /^[a-z]:/i;

function checkImageUrl(url: string): ImagePathResult {
  if (url.length > MAX_IMAGE_URL_CHARS) return { ok: false, reason: 'IMAGE_PATH_URL_TOO_LONG' };
  if (WHITESPACE.test(url) || !AUTHORITY_FOLLOWS.test(url))
    return { ok: false, reason: 'IMAGE_PATH_URL_INVALID' };
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'IMAGE_PATH_URL_INVALID' };
  }
  if (parsed.username !== '' || parsed.password !== '') {
    return { ok: false, reason: 'IMAGE_PATH_URL_CREDENTIALS' };
  }
  if (parsed.hostname === '') return { ok: false, reason: 'IMAGE_PATH_URL_INVALID' };
  return { ok: true, path: url, kind: 'url' };
}

/**
 * Syntax check only, with no file-system or network access. An `http://` or `https://` URL is
 * accepted as written; any other scheme is rejected. For a local path, slash and backslash both
 * separate segments and the result is the trimmed relative path with `/` separators.
 */
export function checkImagePath(input: string): ImagePathResult {
  const trimmed = input.trim();
  if (trimmed === '') {
    return { ok: false, reason: 'IMAGE_PATH_EMPTY' };
  }
  if (CONTROL_CHARS.test(trimmed)) {
    return { ok: false, reason: 'IMAGE_PATH_CONTROL_CHARS' };
  }
  if (HTTP_URL.test(trimmed)) {
    return checkImageUrl(trimmed);
  }
  if (URL_SCHEME.test(trimmed)) {
    return { ok: false, reason: 'IMAGE_PATH_URL_SCHEME' };
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
  return { ok: true, path, kind: 'local' };
}
