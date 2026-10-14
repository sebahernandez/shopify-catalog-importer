import * as fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { checkImagePath } from './image-path.js';

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
    expect(checkImagePath(input)).toEqual({ ok: true, path });
  });

  it.each([
    ['/etc/passwd', 'IMAGE_PATH_ABSOLUTE'],
    ['C:\\a.jpg', 'IMAGE_PATH_ABSOLUTE'],
    ['\\\\server\\share\\a.jpg', 'IMAGE_PATH_ABSOLUTE'],
    ['..\\x.jpg', 'IMAGE_PATH_TRAVERSAL'],
    ['fotos/../x.jpg', 'IMAGE_PATH_TRAVERSAL'],
    ['https://x.test/a.jpg', 'IMAGE_PATH_URL'],
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
