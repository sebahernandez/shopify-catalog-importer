import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import type { Keyring } from '../key-provider.port.js';
import { SecretBoxError } from '../secret-box-error.js';
import type { SecretBox } from '../secret-box.port.js';

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'sb1';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
/** Plaintext limit in UTF-8 bytes. Credentials are short; this is a generous guard, not a format limit. */
export const MAX_PLAINTEXT_BYTES = 262_144;
/** Envelope limit in characters, checked before any decoding or cryptographic work. */
export const MAX_ENVELOPE_LENGTH = 1_048_576;

/**
 * A key id never contains `.` (envelope separator) or `|` (AAD separator). Because of this the
 * first two `|` of the AAD always delimit the version and the key id, so two different
 * (keyId, context) pairs can never produce the same AAD bytes, whatever the context holds.
 */
const KEY_ID = /^[A-Za-z0-9_-]{1,32}$/;
// In unicode mode a surrogate pair is one code point, so this matches only unpaired surrogates.
const LONE_SURROGATE = /\p{Surrogate}/u;
const BASE64URL = /^[A-Za-z0-9_-]*$/;

// `ignoreBOM` keeps a leading U+FEFF as part of the text so it survives a round trip.
const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

const malformed = (): SecretBoxError =>
  new SecretBoxError('MALFORMED_ENVELOPE', 'The envelope is malformed.');
const decryptFailed = (): SecretBoxError =>
  new SecretBoxError('DECRYPT_FAILED', 'Decryption failed.');
const invalidInput = (): SecretBoxError =>
  new SecretBoxError('INVALID_INPUT', 'The input is not acceptable.');
const invalidKey = (): SecretBoxError =>
  new SecretBoxError('INVALID_KEY', 'The keyring is not valid.');

/** Strict canonical base64url: the decoded bytes must re-encode to exactly the same string. */
function decodeSegment(segment: string): Buffer | null {
  if (!BASE64URL.test(segment)) return null;
  const bytes = Buffer.from(segment, 'base64url');
  return bytes.toString('base64url') === segment ? bytes : null;
}

function isWellFormedText(value: unknown): value is string {
  return typeof value === 'string' && !LONE_SURROGATE.test(value);
}

function additionalData(keyId: string, context: string): Buffer {
  return Buffer.from(`${VERSION}|${keyId}|${context}`, 'utf8');
}

interface ParsedEnvelope {
  readonly keyId: string;
  readonly iv: Buffer;
  readonly ciphertext: Buffer;
  readonly tag: Buffer;
}

function parseEnvelope(envelope: unknown): ParsedEnvelope {
  if (typeof envelope !== 'string' || envelope.length > MAX_ENVELOPE_LENGTH) throw malformed();
  const parts = envelope.split('.');
  const [version, keyId, ivText, ciphertextText, tagText] = parts;
  if (parts.length !== 5 || version !== VERSION) throw malformed();
  if (keyId === undefined || !KEY_ID.test(keyId)) throw malformed();
  if (!ivText || !tagText || ciphertextText === undefined) throw malformed();
  const iv = decodeSegment(ivText);
  const ciphertext = decodeSegment(ciphertextText);
  const tag = decodeSegment(tagText);
  if (iv?.length !== IV_BYTES || ciphertext === null || tag?.length !== TAG_BYTES)
    throw malformed();
  return { keyId, iv, ciphertext, tag };
}

/**
 * AES-256-GCM authenticated encryption with a locally held keyring.
 *
 * Envelope: `sb1.<keyId>.<iv>.<ciphertext>.<tag>`, base64url segments without padding, a random
 * 12-byte IV per call and a 16-byte tag. Additional authenticated data: `sb1|<keyId>|<context>`.
 * The ciphertext segment is empty exactly when the plaintext is empty; every other segment is
 * non-empty.
 *
 * Memory: the instance holds private copies of the 32-byte keys for its whole lifetime (there is
 * no dispose). Each call encodes the plaintext into a `Buffer` it owns and zero-fills that buffer
 * and the decrypted-bytes buffer before returning. JavaScript strings (the plaintext argument, the
 * decrypted result, the envelope) are immutable and garbage collected, so nothing here can wipe them.
 *
 * It has no logger and no other dependency.
 */
export class AesGcmSecretBox implements SecretBox {
  readonly #keys = new Map<string, Buffer>();
  readonly #activeKeyId: string;

  constructor(keyring: Keyring | null) {
    if (keyring === null) {
      throw new SecretBoxError('KEY_MISSING', 'No secret key is available. Check SECRET_KEY_FILE.');
    }
    if (!KEY_ID.test(keyring.activeKeyId) || keyring.keys.size === 0) throw invalidKey();
    for (const [keyId, key] of keyring.keys) {
      if (!KEY_ID.test(keyId) || key.length !== KEY_BYTES) throw invalidKey();
      this.#keys.set(keyId, Buffer.from(key));
    }
    if (!this.#keys.has(keyring.activeKeyId)) throw invalidKey();
    this.#activeKeyId = keyring.activeKeyId;
  }

  encrypt(plaintext: string, context: string): string {
    if (!isWellFormedText(plaintext) || plaintext.length > MAX_PLAINTEXT_BYTES)
      throw invalidInput();
    if (!isWellFormedText(context) || context === '') throw invalidInput();
    const input = Buffer.from(plaintext, 'utf8');
    try {
      if (input.length > MAX_PLAINTEXT_BYTES) throw invalidInput();
      const key = this.#keys.get(this.#activeKeyId) as Buffer;
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
      cipher.setAAD(additionalData(this.#activeKeyId, context));
      const ciphertext = Buffer.concat([cipher.update(input), cipher.final()]);
      const tag = cipher.getAuthTag();
      return [VERSION, this.#activeKeyId, iv, ciphertext, tag]
        .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
        .join('.');
    } finally {
      input.fill(0);
    }
  }

  decrypt(envelope: string, context: string): string {
    if (!isWellFormedText(context) || context === '') throw invalidInput();
    const { keyId, iv, ciphertext, tag } = parseEnvelope(envelope);
    const key = this.#keys.get(keyId);
    if (key === undefined) throw decryptFailed();
    let plain: Buffer | undefined;
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
      decipher.setAAD(additionalData(keyId, context));
      decipher.setAuthTag(tag);
      plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return UTF8.decode(plain);
    } catch {
      // Any library or decoding failure is reported as the one generic authentication failure,
      // without a cause, so no partial plaintext or library detail can escape.
      throw decryptFailed();
    } finally {
      plain?.fill(0);
    }
  }
}
