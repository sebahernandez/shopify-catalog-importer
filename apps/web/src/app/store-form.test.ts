import { describe, expect, it } from 'vitest';
import { EMPTY_CREDENTIALS_FORM } from '../store-form-values';
import { toCreateStoreBody, toCredentials } from './store-form';

const FILLED = {
  displayName: ' Mi tienda ',
  domain: '  Mi-Tienda.MyShopify.com ',
  kind: 'static_token',
  accessToken: 'shpat_12345678',
  clientId: 'left-over-id',
  clientSecret: 'left-over-secret',
} as const;

describe('store form mapping', () => {
  it('sends only the token for the token kind', () => {
    expect(toCredentials(FILLED)).toEqual({ kind: 'static_token', accessToken: 'shpat_12345678' });
  });

  it('sends only the client pair for the client credentials kind', () => {
    expect(toCredentials({ ...FILLED, kind: 'client_credentials' })).toEqual({
      kind: 'client_credentials',
      clientId: 'left-over-id',
      clientSecret: 'left-over-secret',
    });
  });

  it('builds the create body with a normalised domain and the name as typed', () => {
    expect(toCreateStoreBody(FILLED)).toEqual({
      displayName: ' Mi tienda ',
      domain: 'mi-tienda.myshopify.com',
      credentials: { kind: 'static_token', accessToken: 'shpat_12345678' },
    });
  });

  it('starts with the token kind and empty fields', () => {
    expect(EMPTY_CREDENTIALS_FORM.kind).toBe('static_token');
    expect(Object.values(EMPTY_CREDENTIALS_FORM).filter((value) => value === '')).toHaveLength(5);
  });
});
