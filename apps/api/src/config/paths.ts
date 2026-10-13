import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export type PathErrorCode =
  | 'PATH_EMPTY'
  | 'PATH_NUL'
  | 'PATH_TILDE_FORM'
  | 'PATH_HOME_UNAVAILABLE'
  | 'PATH_ROOT_INVALID'
  | 'PATH_ROOT_NOT_FOUND';

/** Raised for a path that cannot be resolved. The message is fixed text and never holds the path. */
export class PathError extends Error {
  readonly code: PathErrorCode;

  constructor(code: PathErrorCode, reason: string) {
    super(reason);
    this.name = 'PathError';
    this.code = code;
  }
}

export interface PathContext {
  /** Absolute. Relative paths resolve against it, never against the working directory. */
  readonly workspaceRoot: string;
  /** Absolute. Injectable so tests never read the real home directory. */
  readonly home: string;
}

const WORKSPACE_MARKER = 'pnpm-workspace.yaml';

function isSeparator(character: string | undefined): boolean {
  return character === '/' || character === sep;
}

/**
 * The workspace root is the nearest folder, starting at `startDir` and going up, that holds
 * `pnpm-workspace.yaml`. The default start is this module's own folder, so the answer is the same
 * from source (tests, watch mode) and from `dist`, and never depends on where the process was
 * started.
 */
export function findWorkspaceRoot(
  startDir: string = dirname(fileURLToPath(import.meta.url)),
): string {
  let current = resolve(startDir);
  for (;;) {
    if (existsSync(join(current, WORKSPACE_MARKER))) return current;
    const parent = dirname(current);
    if (parent === current) {
      throw new PathError(
        'PATH_ROOT_NOT_FOUND',
        `no ${WORKSPACE_MARKER} found above the start folder.`,
      );
    }
    current = parent;
  }
}

/**
 * Turns a configured path into an absolute, normalised one. A leading `~` followed by a separator
 * (or alone) is the home directory; any other leading `~` is refused, because `~name` would name
 * another account and silently treating it as a relative folder is a trap. Everything else is
 * relative to the workspace root. Parent segments may leave the workspace on purpose: an operator
 * can point the data folder elsewhere. Pure: nothing is read from or written to the file system.
 */
export function resolveConfigPath(value: string, context: PathContext): string {
  if (value === '') throw new PathError('PATH_EMPTY', 'the path is empty.');
  if (value.includes('\0')) throw new PathError('PATH_NUL', 'the path contains a NUL character.');
  if (!isAbsolute(context.workspaceRoot)) {
    throw new PathError('PATH_ROOT_INVALID', 'the workspace root is not an absolute path.');
  }

  if (value.startsWith('~')) {
    if (value.length > 1 && !isSeparator(value[1])) {
      throw new PathError(
        'PATH_TILDE_FORM',
        'a leading ~ must be followed by a separator; the ~name form is not supported (write ./~name for a literal folder).',
      );
    }
    if (!isAbsolute(context.home)) {
      throw new PathError(
        'PATH_HOME_UNAVAILABLE',
        'the home directory is unknown or not absolute.',
      );
    }
    return resolve(context.home, value.slice(2));
  }
  return resolve(context.workspaceRoot, value);
}
