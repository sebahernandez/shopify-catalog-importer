import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseShopDomain, type ShopDomainReason } from './shop-domain.js';

const outcome = (input: string): string => {
  const result = parseShopDomain(input);
  return result.ok ? result.domain : result.reason;
};

const ACCEPTED: readonly (readonly [string, string])[] = [
  ['MyStore', 'mystore.myshopify.com'],
  ['mystore.myshopify.com', 'mystore.myshopify.com'],
  ['https://mystore.myshopify.com/admin/products?limit=5#top', 'mystore.myshopify.com'],
  ['http://mystore.myshopify.com', 'mystore.myshopify.com'],
  ['https://DEMO.myshopify.com/admin/products', 'demo.myshopify.com'],
  ['https://demo.myshopify.com', 'demo.myshopify.com'],
  ['https://demo.myshopify.com/', 'demo.myshopify.com'],
  ['https://demo.myshopify.com/admin', 'demo.myshopify.com'],
  ['https://demo.myshopify.com/admin/x', 'demo.myshopify.com'],
  ['ab', 'ab.myshopify.com'],
  ['a'.repeat(60), `${'a'.repeat(60)}.myshopify.com`],
  ['2130706433', '2130706433.myshopify.com'],
];

const REJECTED: readonly (readonly [ShopDomainReason, readonly string[]])[] = [
  ['INVALID_HANDLE', ['a', 'a'.repeat(61), 'my_store', '-store', 'store-', 'xn--mystore-abc']],
  [
    'WRONG_SUFFIX',
    [
      'myshopify.com.evil.example',
      'evilmyshopify.com',
      'https://evil.example/mystore.myshopify.com',
      'https://shop.example.com',
      'myshopify.com',
    ],
  ],
  ['EXTRA_LABELS', ['a.b.myshopify.com']],
  ['ADMIN_STORE_URL', ['https://admin.shopify.com/store/mystore']],
];

describe('parseShopDomain host rules', () => {
  it.each(ACCEPTED)('accepts %j as %s', (input, expected) => {
    expect(outcome(input)).toBe(expected);
  });

  for (const [reason, inputs] of REJECTED) {
    it.each(inputs)(`${reason} for %j`, (input) => {
      expect(outcome(input)).toBe(reason);
    });
  }

  it('rejects an embedded space before the host rules', () => {
    expect(outcome('my store')).toBe('WHITESPACE');
  });

  it('keeps the suffix in one constant and reads no environment or URL', () => {
    const source = readFileSync(new URL('./shop-domain.ts', import.meta.url), 'utf8');
    expect(source).not.toContain('process.env');
    expect(source).not.toMatch(/new URL|URL\(/);
    expect(source.match(/\.myshopify\.com/g)?.length).toBe(1);
  });
});
