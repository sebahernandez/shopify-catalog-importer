import * as fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { checkImagePath, MAX_IMAGE_URL_CHARS } from './image-path.js';

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    existsSync: vi.fn(actual.existsSync),
    statSync: vi.fn(actual.statSync),
    readFileSync: vi.fn(actual.readFileSync),
    realpathSync: vi.fn(actual.realpathSync),
  };
});

describe('checkImagePath', () => {
  it.each([
    ['fotos/camisa 1.jpg', 'fotos/camisa 1.jpg'],
    ['camisa.png', 'camisa.png'],
    ['  fotos\\a.jpg ', 'fotos/a.jpg'],
  ])('accepts %j', (input, path) => {
    expect(checkImagePath(input)).toEqual({ ok: true, path, kind: 'local' });
  });

  it.each([
    ['https://x.test/a.jpg', 'https://x.test/a.jpg'],
    ['  http://x.test/a.jpg?w=1&h=2#f ', 'http://x.test/a.jpg?w=1&h=2#f'],
    ['HTTPS://CDN.x.test:8443/a%20b.jpg', 'HTTPS://CDN.x.test:8443/a%20b.jpg'],
  ])('accepts the URL %j as written', (input, path) => {
    expect(checkImagePath(input)).toEqual({ ok: true, path, kind: 'url' });
  });

  it.each([
    ['file:///etc/passwd', 'IMAGE_PATH_URL_SCHEME'],
    ['javascript:alert(1)', 'IMAGE_PATH_URL_SCHEME'],
    ['data:image/png;base64,AAAA', 'IMAGE_PATH_URL_SCHEME'],
    ['ftp://x.test/a.jpg', 'IMAGE_PATH_URL_SCHEME'],
    ['https://user:pw@x.test/a.jpg', 'IMAGE_PATH_URL_CREDENTIALS'],
    ['https://user@x.test/a.jpg', 'IMAGE_PATH_URL_CREDENTIALS'],
    ['https://x.test/a b.jpg', 'IMAGE_PATH_URL_INVALID'],
    ['https:///a.jpg', 'IMAGE_PATH_URL_INVALID'],
    ['http://', 'IMAGE_PATH_URL_INVALID'],
    [`https://x.test/${'a'.repeat(2048)}`, 'IMAGE_PATH_URL_TOO_LONG'],
  ])('rejects the URL %j with %s', (input, reason) => {
    expect(checkImagePath(input)).toEqual({ ok: false, reason });
  });

  it('accepts a URL of exactly the maximum length', () => {
    const url = `https://x.test/${'a'.repeat(MAX_IMAGE_URL_CHARS - 'https://x.test/'.length)}`;
    expect(checkImagePath(url)).toMatchObject({ ok: true, kind: 'url' });
  });

  it.each([
    ['/etc/passwd', 'IMAGE_PATH_ABSOLUTE'],
    ['C:\\a.jpg', 'IMAGE_PATH_ABSOLUTE'],
    ['\\\\server\\share\\a.jpg', 'IMAGE_PATH_ABSOLUTE'],
    ['..\\x.jpg', 'IMAGE_PATH_TRAVERSAL'],
    ['fotos/../x.jpg', 'IMAGE_PATH_TRAVERSAL'],
    ['fotos/', 'IMAGE_PATH_NO_FILENAME'],
    ['fotos\\', 'IMAGE_PATH_NO_FILENAME'],
    ['a\u0000b.jpg', 'IMAGE_PATH_CONTROL_CHARS'],
    ['a\nb.jpg', 'IMAGE_PATH_CONTROL_CHARS'],
    ['   ', 'IMAGE_PATH_EMPTY'],
  ])('rejects %j with %s', (input, reason) => {
    expect(checkImagePath(input)).toEqual({ ok: false, reason });
  });

  it('never touches the file system, even for a path that exists', () => {
    checkImagePath(import.meta.filename);
    checkImagePath('package.json');
    for (const spy of [fs.existsSync, fs.statSync, fs.readFileSync, fs.realpathSync]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
