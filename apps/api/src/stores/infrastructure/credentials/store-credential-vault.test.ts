import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearRegisteredSecretsForTests,
  redactString,
  REDACTED,
} from '../../../shared-kernel/logging/redact.js';
import { DeferredSecretBox } from '../../../shared-kernel/secret-box/deferred-secret-box.js';
import { AesGcmSecretBox } from '../../../shared-kernel/secret-box/infrastructure/aes-gcm-secret-box.js';
import { SecretBoxError } from '../../../shared-kernel/secret-box/secret-box-error.js';
import type { CredentialsPayload } from '../../domain/credentials-payload.js';
import { CredentialsUnreadableError } from '../../ports/credentials-unreadable.error.js';
import { StoreCredentialVault } from './store-credential-vault.js';

const keyring = { activeKeyId: 'k1', keys: new Map([['k1', Buffer.alloc(32, 0x44)]]) };
const TOKEN = 'synthetic-access-token-0005';
const SECRET = 'synthetic-client-secret-0006';
const CLIENT_ID = 'synthetic-client-id-0007';
const STATIC: CredentialsPayload = { kind: 'static_token', accessToken: TOKEN };
const PAIR: CredentialsPayload = {
  kind: 'client_credentials',
  clientId: CLIENT_ID,
  clientSecret: SECRET,
};

const vault = (): StoreCredentialVault => new StoreCredentialVault(new AesGcmSecretBox(keyring));

function unreadable(action: () => unknown): CredentialsUnreadableError {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(CredentialsUnreadableError);
    return error as CredentialsUnreadableError;
  }
  throw new Error('expected CredentialsUnreadableError');
}

beforeEach(clearRegisteredSecretsForTests);

describe('StoreCredentialVault', () => {
  it('seals into an sb1 envelope that holds no canary and opens it back, any id case', () => {
    const envelope = vault().seal('ABC-1', PAIR);
    expect(envelope.startsWith('sb1.')).toBe(true);
    for (const canary of [SECRET, CLIENT_ID]) expect(envelope).not.toContain(canary);
    expect(vault().open('abc-1', 'client_credentials', envelope)).toEqual(PAIR);
    expect(vault().open('abc-1', 'static_token', vault().seal('abc-1', STATIC))).toEqual(STATIC);
  });

  it('turns a foreign context, swapped envelopes and a wrong shape into one fixed error', () => {
    const own = vault().seal('store-a', STATIC);
    const other = vault().seal('store-b', STATIC);
    const failures = [
      unreadable(() => vault().open('store-b', 'static_token', own)),
      unreadable(() => vault().open('store-a', 'static_token', other)),
      unreadable(() => vault().open('store-a', 'client_credentials', own)),
    ];
    for (const error of failures) {
      expect(error.message).toBe(failures[0]?.message);
      expect(error.cause).toBeUndefined();
      expect(error.message).not.toContain(TOKEN);
    }
  });

  it('registers accessToken and clientSecret on seal and on open, and clientId never', () => {
    const sealed = vault().seal('store-a', PAIR);
    expect(redactString(`${SECRET} ${CLIENT_ID}`)).toBe(`${REDACTED} ${CLIENT_ID}`);
    clearRegisteredSecretsForTests();
    vault().open('store-a', 'client_credentials', sealed);
    expect(redactString(`${SECRET} ${CLIENT_ID}`)).toBe(`${REDACTED} ${CLIENT_ID}`);
    clearRegisteredSecretsForTests();
    vault().seal('store-a', STATIC);
    expect(redactString(TOKEN)).toBe(REDACTED);
  });

  it('throws the box error and registers nothing while the box is unbound', () => {
    const unbound = new StoreCredentialVault(new DeferredSecretBox());
    expect(() => unbound.seal('store-a', STATIC)).toThrow(SecretBoxError);
    expect(redactString(TOKEN)).toBe(TOKEN);
  });
});
