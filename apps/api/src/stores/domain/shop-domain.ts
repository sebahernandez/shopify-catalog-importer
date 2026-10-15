/** Closed set of reasons a shop domain input is rejected. A reason never carries the input. */
export type ShopDomainReason =
  | 'EMPTY'
  | 'WHITESPACE'
  | 'NON_ASCII'
  | 'BACKSLASH'
  | 'PERCENT_ENCODING'
  | 'USERINFO'
  | 'PORT'
  | 'PATH'
  | 'TRAILING_DOT'
  | 'IP_LITERAL'
  | 'INVALID_HANDLE'
  | 'WRONG_SUFFIX'
  | 'EXTRA_LABELS'
  | 'ADMIN_STORE_URL';

declare const shopDomainBrand: unique symbol;
/** A canonical shop host (handle plus the fixed suffix); only `parseShopDomain` builds one. */
export type ShopDomain = string & { readonly [shopDomainBrand]: true };

export type ShopDomainResult =
  | { readonly ok: true; readonly domain: ShopDomain }
  | { readonly ok: false; readonly reason: ShopDomainReason };

const reject = (reason: ShopDomainReason): ShopDomainResult => ({ ok: false, reason });

const syntaxReason = (input: string): ShopDomainReason | null => {
  if (input === '') return 'EMPTY';
  if (/\s/.test(input)) return 'WHITESPACE';
  if (/[^\x21-\x7e]/.test(input)) return 'NON_ASCII';
  if (input.includes('\\')) return 'BACKSLASH';
  if (input.includes('%')) return 'PERCENT_ENCODING';
  return null;
};

/** The only host suffix a request may target. It is a constant, never configuration. */
const SHOP_SUFFIX = '.myshopify.com';
const ADMIN_HOST = 'admin.shopify.com';
const HANDLE = /^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$/;
const SCHEME = /^https?:\/\//i;

const authorityReason = (authority: string): ShopDomainReason | null => {
  if (authority.includes('@')) return 'USERINFO';
  if (authority.startsWith('[')) return 'IP_LITERAL';
  if (authority.includes(':')) return 'PORT';
  if (authority.endsWith('.')) return 'TRAILING_DOT';
  if (/^\d+\.\d+\.\d+\.\d+$/.test(authority)) return 'IP_LITERAL';
  return null;
};

/** Steps 4 and 5: the host must be one valid handle label plus the fixed suffix. */
const handleOf = (host: string): string | { readonly reason: ShopDomainReason } => {
  if (host === ADMIN_HOST) return { reason: 'ADMIN_STORE_URL' };
  let handle = host;
  if (host.endsWith(SHOP_SUFFIX)) {
    handle = host.slice(0, -SHOP_SUFFIX.length);
    if (handle.includes('.')) return { reason: 'EXTRA_LABELS' };
  } else if (host.includes('.')) return { reason: 'WRONG_SUFFIX' };
  return HANDLE.test(handle) && !handle.startsWith('xn--') ? handle : { reason: 'INVALID_HANDLE' };
};

/** URL form only: empty, a single slash, or `admin` with optional further segments. */
const pathAllowed = (path: string): boolean =>
  path === '' || path === '/' || /^\/admin(\/|$)/.test(path);

/** Parses operator input into a canonical shop domain, or a rejection reason (design D10). */
export const parseShopDomain = (input: string): ShopDomainResult => {
  const syntax = syntaxReason(input);
  if (syntax) return reject(syntax);
  const isUrl = SCHEME.test(input);
  const rest = isUrl ? input.replace(SCHEME, '') : input;
  const end = rest.search(/[/?#]/);
  if (!isUrl && end !== -1) return reject('PATH');
  const authority = (end === -1 ? rest : rest.slice(0, end)).toLowerCase();
  const failure = authorityReason(authority);
  if (failure) return reject(failure);
  const handle = handleOf(authority);
  if (typeof handle !== 'string') return reject(handle.reason);
  const path = end === -1 ? '' : (rest.slice(end).split(/[?#]/)[0] ?? '');
  if (isUrl && !pathAllowed(path)) return reject('PATH');
  return { ok: true, domain: `${handle}${SHOP_SUFFIX}` as ShopDomain };
};
