import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LOCATIONS_ALTERNATIVES, REQUIRED_CAPABILITIES } from './shopify-scopes.js';

describe('shopify scopes', () => {
  it('lists the required capabilities in order', () => {
    expect(REQUIRED_CAPABILITIES).toEqual([
      'write_products',
      'write_files',
      'write_inventory',
      'locations',
    ]);
  });

  it('lists the three alternatives that satisfy locations', () => {
    expect(LOCATIONS_ALTERNATIVES).toEqual([
      'read_locations',
      'read_inventory',
      'read_markets_home',
    ]);
  });

  it('freezes the constants', () => {
    expect(Object.isFrozen(REQUIRED_CAPABILITIES)).toBe(true);
    expect(Object.isFrozen(LOCATIONS_ALTERNATIVES)).toBe(true);
  });

  it('has no node: import', () => {
    const source = readFileSync(new URL('./shopify-scopes.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from\s+['"]node:/);
  });
});
