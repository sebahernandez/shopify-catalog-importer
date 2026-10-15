import { describe, expect, it } from 'vitest';
import { createLocationResolver } from './import-location-resolver.js';

const loc = (id: string, name: string, isActive = true) => ({
  id: `gid://shopify/Location/${id}`,
  name,
  isActive,
  fulfillsOnlineOrders: true,
});

describe('createLocationResolver', () => {
  const resolve = createLocationResolver([loc('1', 'Depósito'), loc('2', 'Tienda')], false);

  it('matches a name exactly, ignoring surrounding spaces and Unicode form', () => {
    expect(resolve(' Tienda ')).toEqual({ ok: true, id: 'gid://shopify/Location/2' });
    expect(resolve('Deposito'.replace('o', 'ó'))).toMatchObject({ ok: true });
    expect(resolve('Depósito')).toEqual({ ok: true, id: 'gid://shopify/Location/1' });
  });

  it('falls back to a case-insensitive match', () => {
    expect(resolve('tienda')).toEqual({ ok: true, id: 'gid://shopify/Location/2' });
  });

  it('prefers the exact match over a case-insensitive one', () => {
    const both = createLocationResolver([loc('1', 'Main'), loc('2', 'main')], false);
    expect(both('main')).toEqual({ ok: true, id: 'gid://shopify/Location/2' });
  });

  it('reports an unknown name', () => {
    expect(resolve('Otra')).toEqual({ ok: false, code: 'LOCATION_NOT_FOUND' });
  });

  it('reports a name that matches several locations', () => {
    const twins = createLocationResolver([loc('1', 'Main'), loc('2', 'Main')], false);
    expect(twins('Main')).toEqual({ ok: false, code: 'LOCATION_AMBIGUOUS' });
    const folded = createLocationResolver([loc('1', 'MAIN'), loc('2', 'main')], false);
    expect(folded('Main')).toEqual({ ok: false, code: 'LOCATION_AMBIGUOUS' });
  });

  it('ignores inactive locations', () => {
    const only = createLocationResolver([loc('1', 'Main', false), loc('2', 'Other')], false);
    expect(only('Main')).toEqual({ ok: false, code: 'LOCATION_NOT_FOUND' });
  });

  it.each([undefined, '', '   '])('uses the one active location for %j', (name) => {
    const single = createLocationResolver([loc('1', 'Main'), loc('2', 'Old', false)], false);
    expect(single(name)).toEqual({ ok: true, id: 'gid://shopify/Location/1' });
  });

  it('requires a name when there are two active locations, none, or a truncated list', () => {
    expect(resolve(undefined)).toEqual({ ok: false, code: 'LOCATION_REQUIRED' });
    expect(createLocationResolver([], false)(undefined)).toEqual({
      ok: false,
      code: 'LOCATION_REQUIRED',
    });
    expect(createLocationResolver([loc('1', 'Main')], true)(undefined)).toEqual({
      ok: false,
      code: 'LOCATION_REQUIRED',
    });
  });
});
