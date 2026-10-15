import { describe, expect, it } from 'vitest';
import { CredentialsPayload } from './stores.js';

const staticToken = { kind: 'static_token', accessToken: 'shpat_' + 'a'.repeat(32) };
const clientCredentials = { kind: 'client_credentials', clientId: 'i', clientSecret: 'secret-12' };

describe('CredentialsPayload', () => {
  it('accepts a static_token with a 38 character token', () => {
    expect(staticToken.accessToken).toHaveLength(38);
    expect(CredentialsPayload.parse(staticToken)).toEqual(staticToken);
  });

  it('accepts client_credentials, including a 1 character clientId', () => {
    expect(CredentialsPayload.parse(clientCredentials)).toEqual(clientCredentials);
  });

  it('accepts secrets of exactly 8 and 512 characters', () => {
    for (const length of [8, 512]) {
      const value = 'x'.repeat(length);
      expect(CredentialsPayload.safeParse({ ...staticToken, accessToken: value }).success).toBe(
        true,
      );
      expect(
        CredentialsPayload.safeParse({ ...clientCredentials, clientSecret: value }).success,
      ).toBe(true);
    }
  });

  it.each([
    ['unknown kind', { kind: 'oauth', accessToken: 'abcdefgh' }],
    ['missing clientSecret', { kind: 'client_credentials', clientId: 'id' }],
    ['7 character accessToken', { ...staticToken, accessToken: 'x'.repeat(7) }],
    ['7 character clientSecret', { ...clientCredentials, clientSecret: 'x'.repeat(7) }],
    ['513 character accessToken', { ...staticToken, accessToken: 'x'.repeat(513) }],
    ['513 character clientId', { ...clientCredentials, clientId: 'x'.repeat(513) }],
    ['empty clientId', { ...clientCredentials, clientId: '' }],
    ['extra field', { ...staticToken, extra: 1 }],
  ])('rejects %s', (_label, value) => {
    expect(CredentialsPayload.safeParse(value).success).toBe(false);
  });

  it('trims surrounding whitespace before measuring and returning', () => {
    const parsed = CredentialsPayload.parse({
      ...staticToken,
      accessToken: `${staticToken.accessToken}\n`,
    });
    expect(parsed).toEqual(staticToken);
    expect(
      CredentialsPayload.safeParse({ ...staticToken, accessToken: `  ${'x'.repeat(7)}  ` }).success,
    ).toBe(false);
  });
});
