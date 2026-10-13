import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PathError, findWorkspaceRoot, resolveConfigPath } from './paths.js';

// Synthetic locations. Nothing here exists on disk and nothing reads the real home directory.
const ROOT = resolve(sep, 'work', 'space');
const HOME = resolve(sep, 'home', 'tester');
const where = { workspaceRoot: ROOT, home: HOME };

function failure(action: () => unknown): PathError {
  try {
    action();
  } catch (error) {
    if (error instanceof PathError) return error;
    throw error;
  }
  throw new Error('expected a PathError');
}

describe('relative paths', () => {
  it.each([
    ['./data', join(ROOT, 'data')],
    ['data', join(ROOT, 'data')],
    ['data/nested/db', join(ROOT, 'data', 'nested', 'db')],
    ['a/./b//c', join(ROOT, 'a', 'b', 'c')],
    ['./a/../b', join(ROOT, 'b')],
  ])('resolves %s against the workspace root', (input, expected) => {
    expect(resolveConfigPath(input, where)).toBe(expected);
  });

  it('does not depend on the current working directory', () => {
    const before = process.cwd();
    try {
      process.chdir(tmpdir());
      expect(resolveConfigPath('./data', where)).toBe(join(ROOT, 'data'));
    } finally {
      process.chdir(before);
    }
  });

  it('allows leaving the workspace through parent segments', () => {
    expect(resolveConfigPath('../elsewhere/data', where)).toBe(
      resolve(ROOT, '..', 'elsewhere', 'data'),
    );
  });
});

describe('absolute paths', () => {
  it('keeps an absolute path and normalises it', () => {
    expect(resolveConfigPath(resolve(sep, 'srv', 'x', '..', 'data'), where)).toBe(
      resolve(sep, 'srv', 'data'),
    );
  });

  it('ignores the workspace root and the home directory', () => {
    expect(resolveConfigPath(resolve(sep, 'srv', 'data'), where)).toBe(resolve(sep, 'srv', 'data'));
  });
});

describe('home directory shorthand', () => {
  it.each([
    ['~', HOME],
    ['~/.app/secret.key', join(HOME, '.app', 'secret.key')],
    ['~/', HOME],
    ['~/a/../b', join(HOME, 'b')],
  ])('expands %s in the leading position', (input, expected) => {
    expect(resolveConfigPath(input, where)).toBe(expected);
  });

  it.each(['./~/x', 'a/~/x', 'a/~', 'data~'])('leaves %s untouched (not leading)', (input) => {
    expect(resolveConfigPath(input, where)).toBe(resolve(ROOT, input));
  });

  it.each(['~root/x', '~root', '~alice/.key', '~.hidden', '~~', '~x/'])(
    'rejects %s, the form that names another account or a lookalike',
    (input) => {
      expect(failure(() => resolveConfigPath(input, where)).code).toBe('PATH_TILDE_FORM');
    },
  );

  it('rejects a shorthand when no usable home directory is supplied', () => {
    expect(failure(() => resolveConfigPath('~/x', { workspaceRoot: ROOT, home: '' })).code).toBe(
      'PATH_HOME_UNAVAILABLE',
    );
    expect(
      failure(() => resolveConfigPath('~/x', { workspaceRoot: ROOT, home: 'relative/home' })).code,
    ).toBe('PATH_HOME_UNAVAILABLE');
  });

  it('does not need a home directory for paths that do not use the shorthand', () => {
    expect(resolveConfigPath('data', { workspaceRoot: ROOT, home: '' })).toBe(join(ROOT, 'data'));
  });
});

describe('invalid input', () => {
  it('rejects a NUL character anywhere, without echoing the value', () => {
    const error = failure(() => resolveConfigPath('data/\0evil-marker', where));
    expect(error.code).toBe('PATH_NUL');
    expect(error.message).not.toContain('evil-marker');
  });

  it('rejects an empty path', () => {
    expect(failure(() => resolveConfigPath('', where)).code).toBe('PATH_EMPTY');
  });

  it('rejects a workspace root that is not absolute', () => {
    expect(
      failure(() => resolveConfigPath('data', { workspaceRoot: 'rel', home: HOME })).code,
    ).toBe('PATH_ROOT_INVALID');
  });
});

describe('findWorkspaceRoot', () => {
  let base: string;

  beforeEach(async () => {
    base = await realpath(await mkdtemp(join(tmpdir(), 'importer-paths-')));
  });

  afterEach(async () => {
    await rm(base, { recursive: true, force: true });
  });

  it('walks up from a nested folder to the folder holding pnpm-workspace.yaml', async () => {
    await writeFile(join(base, 'pnpm-workspace.yaml'), 'packages: []\n');
    const nested = join(base, 'apps', 'api', 'src');
    await mkdir(nested, { recursive: true });
    expect(findWorkspaceRoot(nested)).toBe(base);
    expect(findWorkspaceRoot(base)).toBe(base);
  });

  it('prefers the nearest marker', async () => {
    await writeFile(join(base, 'pnpm-workspace.yaml'), 'packages: []\n');
    const inner = join(base, 'inner');
    await mkdir(inner);
    await writeFile(join(inner, 'pnpm-workspace.yaml'), 'packages: []\n');
    expect(findWorkspaceRoot(join(inner, 'deep'))).toBe(inner);
  });

  it('fails with a typed error when no marker exists above the start', () => {
    expect(failure(() => findWorkspaceRoot(base)).code).toBe('PATH_ROOT_NOT_FOUND');
  });

  it('finds this repository from the default start, whatever the working directory', () => {
    const before = process.cwd();
    try {
      process.chdir(tmpdir());
      const root = findWorkspaceRoot();
      expect(existsSync(join(root, 'pnpm-workspace.yaml'))).toBe(true);
      expect(existsSync(join(root, 'apps', 'api', 'package.json'))).toBe(true);
    } finally {
      process.chdir(before);
    }
  });
});
