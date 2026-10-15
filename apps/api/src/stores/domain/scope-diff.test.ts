import { describe, expect, it } from 'vitest';
import { diffScopes } from './scope-diff.js';

const missing = (granted: string[]): string[] => [...diffScopes(granted).missing];

describe('diffScopes', () => {
  it('is met by the three write scopes, write_inventory covering locations', () => {
    expect(missing(['write_products', 'write_files', 'write_inventory'])).toEqual([]);
  });

  it('reports a read that does not meet a write', () => {
    expect(missing(['read_products', 'write_files', 'write_inventory'])).toEqual([
      'write_products',
    ]);
    expect(missing(['write_products', 'read_files', 'write_inventory'])).toEqual(['write_files']);
  });

  it('meets locations through an alternative', () => {
    expect(missing(['write_products', 'write_files', 'read_locations'])).toEqual([
      'write_inventory',
    ]);
    expect(missing(['write_products', 'write_files'])).toEqual(['write_inventory', 'locations']);
  });

  it('orders missing like the required list and keeps granted verbatim', () => {
    const granted = ['b_scope', 'a_scope'];
    const diff = diffScopes(granted);
    expect(diff.granted).toEqual(granted);
    expect(diff.missing).toEqual(['write_products', 'write_files', 'write_inventory', 'locations']);
  });
});
