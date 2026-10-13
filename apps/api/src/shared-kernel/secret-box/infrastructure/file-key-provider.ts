import { randomBytes } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  statSync,
  unlinkSync,
  writeSync,
  type Stats,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import type { KeyProvider, Keyring } from '../key-provider.port.js';

export type KeyFileErrorCode =
  'KEY_FILE_PATH' | 'KEY_FILE_EXISTS' | 'KEY_FILE_UNSAFE' | 'KEY_FILE_MALFORMED' | 'KEY_FILE_IO';

/**
 * Raised for every key file problem. The message names the path and the reason. It never holds
 * key material, never echoes file content and there is never a `cause`.
 */
export class KeyFileError extends Error {
  readonly code: KeyFileErrorCode;

  constructor(code: KeyFileErrorCode, path: string, reason: string) {
    super(`Key file ${path}: ${reason}`);
    this.name = 'KeyFileError';
    this.code = code;
  }
}

export interface FileKeyProviderOptions {
  /** Absolute path of the key file. Expanding `~` and relative paths is the config layer's job. */
  readonly keyFilePath: string;
  /** Receives fixed-text warnings. The provider never logs by itself. */
  readonly warn?: (message: string) => void;
  /** Injectable so tests can run the Windows branch anywhere. Defaults to `process.platform`. */
  readonly platform?: NodeJS.Platform;
  /** Injectable owner check. Defaults to `process.getuid`. */
  readonly getUid?: () => number | undefined;
}

const KEY_BYTES = 32;
const FIRST_KEY_ID = 'k1';
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;
const GROUP_AND_OTHER = 0o077;
const OWNER_READ = 0o400;
/** A key file holds one short line per key; anything larger is not a key file. */
const MAX_FILE_BYTES = 4096;
const KEY_LINE = /^([A-Za-z0-9_-]{1,32}):([A-Za-z0-9+/]+={0,2})$/;

/** The documented default. The home directory is a parameter so tests never read the real one. */
export function defaultKeyFilePath(home: string = homedir()): string {
  return join(home, '.shopify-catalog-importer', 'secret.key');
}

/** Parses `<keyId>:<base64 of 32 bytes>` lines. The last line is the active key. */
function parseKeyring(path: string, bytes: Buffer): Keyring {
  const malformed = (reason: string): KeyFileError =>
    new KeyFileError('KEY_FILE_MALFORMED', path, reason);
  if (bytes.length === 0) throw malformed('the file is empty.');

  // Latin-1 maps each byte to one character, so any non-ASCII byte fails the line pattern.
  let text = bytes.toString('latin1');
  if (text.endsWith('\n')) text = text.slice(0, -1);

  const keys = new Map<string, Uint8Array>();
  let activeKeyId = '';
  for (const [index, content] of text.split('\n').entries()) {
    const match = KEY_LINE.exec(content);
    if (!match) throw malformed(`line ${index + 1} is not <keyId>:<base64 of 32 bytes>.`);
    const [, keyId = '', encoded = ''] = match;
    const key = Buffer.from(encoded, 'base64');
    if (key.length !== KEY_BYTES || key.toString('base64') !== encoded) {
      throw malformed(`line ${index + 1} is not a canonical base64 encoding of exactly 32 bytes.`);
    }
    if (keys.has(keyId)) throw malformed(`line ${index + 1} repeats an earlier key id.`);
    keys.set(keyId, key);
    activeKeyId = keyId;
  }
  return { activeKeyId, keys };
}

/**
 * Loads or creates the key file. On POSIX it enforces owner-only access (file and directory),
 * refuses symlinks and non-regular files, and creates the file exclusively with mode 0600.
 */
export class FileKeyProvider implements KeyProvider {
  private readonly path: string;
  private readonly warn: (message: string) => void;
  private readonly enforcesModes: boolean;
  private readonly getUid: () => number | undefined;
  private warnedAboutModes = false;

  constructor(options: FileKeyProviderOptions) {
    this.path = options.keyFilePath;
    if (!isAbsolute(this.path)) {
      throw new KeyFileError('KEY_FILE_PATH', this.path, 'the path must be absolute.');
    }
    this.warn = options.warn ?? (() => undefined);
    this.enforcesModes = (options.platform ?? process.platform) !== 'win32';
    this.getUid = options.getUid ?? (() => process.getuid?.());
  }

  load(): Keyring | null {
    this.checkDirectory();
    try {
      lstatSync(this.path);
    } catch (error) {
      if (errnoOf(error) === 'ENOENT') return null;
      throw this.ioError('inspect the file', error);
    }
    const bytes = this.readFile();
    try {
      return parseKeyring(this.path, bytes);
    } finally {
      bytes.fill(0);
    }
  }

  generate(): Keyring {
    this.noteModesNotEnforced();
    try {
      mkdirSync(dirname(this.path), { recursive: true, mode: DIRECTORY_MODE });
    } catch (error) {
      throw this.ioError('create its directory', error);
    }
    this.checkDirectory();

    const key = randomBytes(KEY_BYTES);
    const line = Buffer.from(`${FIRST_KEY_ID}:${key.toString('base64')}\n`, 'latin1');
    let fd: number;
    try {
      // `wx` is O_CREAT | O_EXCL: it fails when anything exists at the path, a symlink included.
      fd = openSync(this.path, 'wx', FILE_MODE);
    } catch (error) {
      if (errnoOf(error) === 'EEXIST') {
        throw new KeyFileError(
          'KEY_FILE_EXISTS',
          this.path,
          'it already exists and is not overwritten.',
        );
      }
      throw this.ioError('create the file', error);
    }
    try {
      this.verifyCreatedMode(fd);
      writeSync(fd, line);
    } catch (error) {
      this.discardCreatedFile();
      throw error instanceof KeyFileError ? error : this.ioError('write the file', error);
    } finally {
      closeSync(fd);
      line.fill(0);
    }
    return { activeKeyId: FIRST_KEY_ID, keys: new Map([[FIRST_KEY_ID, key]]) };
  }

  /** The umask can only remove bits, but a filesystem may ignore modes, so the result is checked. */
  private verifyCreatedMode(fd: number): void {
    if (!this.enforcesModes) return;
    const mode = fstatSync(fd).mode;
    if ((mode & GROUP_AND_OTHER) !== 0 || (mode & OWNER_READ) === 0) {
      throw new KeyFileError(
        'KEY_FILE_UNSAFE',
        this.path,
        'it was created with a mode that is not owner-only.',
      );
    }
  }

  /** Removes a file this call created exclusively; nothing else is ever deleted. */
  private discardCreatedFile(): void {
    try {
      unlinkSync(this.path);
    } catch {
      // Nothing more can be done; the original error is the one reported.
    }
  }

  private checkDirectory(): void {
    this.noteModesNotEnforced();
    const directory = dirname(this.path);
    let stats: Stats;
    try {
      stats = statSync(directory);
    } catch (error) {
      if (errnoOf(error) === 'ENOENT') return;
      throw this.ioError('inspect its directory', error);
    }
    if (!stats.isDirectory()) {
      throw this.ioError('use its parent as a directory', { code: 'ENOTDIR' });
    }
    this.checkOwnerOnly(stats, 'its directory');
  }

  private readFile(): Buffer {
    const link = lstatSync(this.path);
    if (link.isSymbolicLink()) {
      throw new KeyFileError('KEY_FILE_UNSAFE', this.path, 'it is a symbolic link.');
    }
    let fd: number;
    try {
      // O_NOFOLLOW closes the window in which the path is swapped for a link after the check.
      fd = openSync(this.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    } catch (error) {
      throw errnoOf(error) === 'ELOOP'
        ? new KeyFileError('KEY_FILE_UNSAFE', this.path, 'it is a symbolic link.')
        : this.ioError('open the file', error);
    }
    try {
      // Checks and read use the descriptor, so they describe the same file.
      const stats = fstatSync(fd);
      if (!stats.isFile()) {
        throw new KeyFileError('KEY_FILE_UNSAFE', this.path, 'it is not a regular file.');
      }
      this.checkOwnerOnly(stats, 'it');
      const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
      const length = readSync(fd, buffer, 0, buffer.length, 0);
      if (length > MAX_FILE_BYTES) {
        buffer.fill(0);
        throw new KeyFileError(
          'KEY_FILE_MALFORMED',
          this.path,
          `the file is larger than ${MAX_FILE_BYTES} bytes.`,
        );
      }
      const content = Buffer.from(buffer.subarray(0, length));
      buffer.fill(0);
      return content;
    } catch (error) {
      throw error instanceof KeyFileError ? error : this.ioError('read the file', error);
    } finally {
      closeSync(fd);
    }
  }

  private checkOwnerOnly(stats: Stats, subject: string): void {
    if (!this.enforcesModes) return;
    if ((stats.mode & GROUP_AND_OTHER) !== 0) {
      const mode = (stats.mode & 0o777).toString(8);
      throw new KeyFileError(
        'KEY_FILE_UNSAFE',
        this.path,
        `${subject} has mode ${mode}; group and other must have no access (use chmod to remove it).`,
      );
    }
    const uid = this.getUid();
    if (uid !== undefined && stats.uid !== uid) {
      throw new KeyFileError(
        'KEY_FILE_UNSAFE',
        this.path,
        `${subject} is owned by a different user.`,
      );
    }
  }

  private noteModesNotEnforced(): void {
    if (this.enforcesModes || this.warnedAboutModes) return;
    this.warnedAboutModes = true;
    this.warn(`Key file ${this.path}: permission checks are skipped on this platform.`);
  }

  private ioError(action: string, error: unknown): KeyFileError {
    return new KeyFileError(
      'KEY_FILE_IO',
      this.path,
      `cannot  (${errnoOf(error) ?? 'unknown error'}).`,
    );
  }
}

function errnoOf(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : undefined;
}
