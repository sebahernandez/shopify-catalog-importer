/** Replacement for a removed secret. */
export const REDACTED = '[REDACTED]';

/**
 * Key-name fragments that mark a field as secret, matched case-insensitively anywhere in the
 * name. The bare word `key` is deliberately absent: it would redact `product_key` and `keyId`.
 * Later slices extend this list (S3 adds staged-upload `parameters`).
 */
export const SECRET_KEY_NAME_PARTS = [
  'authorization',
  'cookie',
  'token',
  'secret',
  'password',
  'signature',
  'credential',
] as const;

/** A name that ends in one of these stems plus `key` is secret (`apiKey`, `private_key`). */
export const SECRET_KEY_NAME_STEMS = [
  'api',
  'private',
  'encryption',
  'access',
  'signing',
  'master',
  'auth',
] as const;

/** Values shorter than this are never registered: they would redact ordinary text. */
export const MIN_REGISTERED_SECRET_LENGTH = 8;

const MAX_DEPTH = 12;
/** Upper bound on visited objects plus visited entries, so shared references cannot explode. */
const MAX_NODES = 10_000;

const TRUNCATED = '[Truncated]';
const CIRCULAR = '[Circular]';
const UNREDACTABLE = '[Unredactable]';

/*
 * Pattern notes: every quantifier is either bounded or sits next to a character class that
 * cannot also match the next token, so none can backtrack quadratically.
 */
/** A scheme (at most 32 characters) followed by `://` and the rest of the non-space run. */
const URL_CANDIDATE = /[a-z][a-z0-9+.-]{0,31}:\/\/[^\s"'<>]+/gi;
const URL_USERINFO = /^([^:]+:\/\/)[^/?#]*@/;
const URL_PARAMETER = /([?&#])([^=&#?]*)=([^&#]*)/g;
const BEARER = /\b(bearer\s+)\S+/gi;
const SHOPIFY_TOKEN = /shp[a-z]{2}_[a-z0-9_]+/gi;

let registered: string[] = [];

/**
 * Registers a value (for example the encryption key) to be removed from every string, wherever
 * it appears. Returns false and registers nothing when the value is too short.
 */
export function registerSecret(value: string): boolean {
  if (value.length < MIN_REGISTERED_SECRET_LENGTH) return false;
  if (!registered.includes(value)) {
    // Longest first, so a secret that contains another is removed whole.
    registered = [...registered, value].sort((a, b) => b.length - a.length);
  }
  return true;
}

/** Test seam: the registry is process-wide state. */
export function clearRegisteredSecretsForTests(): void {
  registered = [];
}

export function isSecretKeyName(name: string): boolean {
  const lower = name.toLowerCase();
  if (SECRET_KEY_NAME_PARTS.some((part) => lower.includes(part))) return true;
  const squashed = lower.replace(/[-_\s]/g, '');
  return SECRET_KEY_NAME_STEMS.some((stem) => squashed.endsWith(`${stem}key`));
}

function redactUrl(url: string): string {
  return url.replace(URL_USERINFO, `$1${REDACTED}@`).replace(URL_PARAMETER, `$1$2=${REDACTED}`);
}

/** Removes registered secrets, URL credentials and parameters, bearer and Shopify tokens. */
export function redactString(text: string): string {
  let out = text;
  for (const secret of registered) {
    if (out.includes(secret)) out = out.split(secret).join(REDACTED);
  }
  return out
    .replace(URL_CANDIDATE, redactUrl)
    .replace(BEARER, `$1${REDACTED}`)
    .replace(SHOPIFY_TOKEN, REDACTED);
}

interface WalkState {
  nodes: number;
  readonly ancestors: Set<object>;
}

function withinBudget(state: WalkState): boolean {
  state.nodes += 1;
  return state.nodes <= MAX_NODES;
}

function child(read: () => unknown, depth: number, state: WalkState): unknown {
  try {
    return walk(read(), depth + 1, state);
  } catch {
    return UNREDACTABLE;
  }
}

function redactProperties(
  source: object,
  names: readonly string[],
  depth: number,
  state: WalkState,
): object {
  const record = source as Record<string, unknown>;
  const entries: [string, unknown][] = [];
  for (const name of names) {
    if (!withinBudget(state)) {
      entries.push(['...', TRUNCATED]);
      break;
    }
    entries.push([
      name,
      isSecretKeyName(name) ? REDACTED : child(() => record[name], depth, state),
    ]);
  }
  // fromEntries defines own properties, so a `__proto__` key cannot change the prototype.
  return Object.fromEntries(entries);
}

function redactArray(value: readonly unknown[], depth: number, state: WalkState): unknown[] {
  const out: unknown[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (!withinBudget(state)) {
      out.push(TRUNCATED);
      break;
    }
    out.push(child(() => value[index], depth, state));
  }
  return out;
}

function redactEntries(value: Map<unknown, unknown>, depth: number, state: WalkState): unknown[] {
  const out: unknown[] = [];
  for (const [key, entry] of value) {
    if (!withinBudget(state)) {
      out.push(TRUNCATED);
      break;
    }
    const secret = typeof key === 'string' && isSecretKeyName(key);
    out.push([
      child(() => key, depth, state),
      secret ? REDACTED : child(() => entry, depth, state),
    ]);
  }
  return out;
}

function redactError(error: Error, depth: number, state: WalkState): object {
  // `name` usually lives on the prototype; `stack`, `message` and `cause` are own but hidden.
  const names = ['name', ...Object.getOwnPropertyNames(error).filter((n) => n !== 'name')];
  return redactProperties(error, names, depth, state);
}

function redactObject(value: object, depth: number, state: WalkState): unknown {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  }
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
    return `[Binary ${value.byteLength} bytes]`;
  }
  if (value instanceof Error) return redactError(value, depth, state);
  if (value instanceof Map) return redactEntries(value, depth, state);
  if (value instanceof Set) return redactArray([...value], depth, state);
  if (Array.isArray(value)) return redactArray(value as unknown[], depth, state);
  const { toJSON } = value as { toJSON?: unknown };
  if (typeof toJSON === 'function') {
    return walk(Reflect.apply(toJSON, value, []), depth + 1, state);
  }
  return redactProperties(value, Object.keys(value), depth, state);
}

function walk(value: unknown, depth: number, state: WalkState): unknown {
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'function') return '[Function]';
  if (typeof value === 'symbol') return redactString(value.toString());
  if (typeof value !== 'object' || value === null) return value;
  if (state.ancestors.has(value)) return CIRCULAR;
  if (depth >= MAX_DEPTH || !withinBudget(state)) return TRUNCATED;
  state.ancestors.add(value);
  try {
    return redactObject(value, depth, state);
  } catch {
    return UNREDACTABLE;
  } finally {
    state.ancestors.delete(value);
  }
}

/**
 * Returns a copy of `value` that is safe to log. Pure with respect to its input (never mutates
 * it) and never throws: anything it cannot read becomes a fixed marker rather than an error.
 * Redaction is best effort (key names, known value patterns, registered secrets), not a proof
 * that nothing sensitive remains.
 */
export function redact(value: unknown): unknown {
  return walk(value, 0, { nodes: 0, ancestors: new Set() });
}
