import { describe, expect, it } from 'vitest';
import { parseShopDomain, type ShopDomainReason } from './shop-domain.js';

const reasonOf = (input: string): ShopDomainReason | 'ACCEPTED' => {
  const result = parseShopDomain(input);
  return result.ok ? 'ACCEPTED' : result.reason;
};

const ROWS: readonly (readonly [ShopDomainReason, readonly string[]])[] = [
  ['EMPTY', ['']],
  ['WHITESPACE', [' mystore', 'mystore ', 'my\nstore', 'mystore.myshopify.com\n']],
  ['NON_ASCII', ['mystоre.myshopify.com', 'mystore.myshopify.com​']],
  ['BACKSLASH', ['mystore.myshopify.com\\evil']],
  ['PERCENT_ENCODING', ['mystore%2emyshopify.com']],
  ['USERINFO', ['https://user:pw@mystore.myshopify.com', 'mystore.myshopify.com@evil.example']],
  ['PORT', ['https://mystore.myshopify.com:8443/admin', 'mystore.myshopify.com:443']],
  ['PATH', ['https://mystore.myshopify.com/other/path', 'mystore/x', 'mystore?x=1', 'mystore#top']],
  ['TRAILING_DOT', ['mystore.myshopify.com.']],
  ['IP_LITERAL', ['127.0.0.1', 'http://[::1]/', 'http://169.254.169.254/']],
];

describe('parseShopDomain syntax rejections', () => {
  for (const [reason, inputs] of ROWS) {
    it.each(inputs)(`${reason} for %j`, (input) => {
      expect(reasonOf(input)).toBe(reason);
    });
  }

  it('lets the first failing step win', () => {
    expect(reasonOf(' a\\b%')).toBe('WHITESPACE');
    expect(reasonOf('a\\b%')).toBe('BACKSLASH');
    expect(reasonOf('u@h:1/x')).toBe('PATH');
  });

  it('never includes the input in the result', () => {
    const secret = 'canary-secret@evil.example';
    expect(JSON.stringify(parseShopDomain(secret))).not.toContain('canary');
  });
});
