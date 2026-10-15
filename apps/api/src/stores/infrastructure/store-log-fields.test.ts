import { describe, expect, it } from 'vitest';
import { isSecretKeyName } from '../../shared-kernel/logging/redact.js';
import {
  isDeclaredStoreLogField,
  STORE_LOG_EVENT_KEY,
  STORE_LOG_FIELDS,
} from './store-log-fields.js';

describe('store log fields', () => {
  it('are exactly the eleven declared names', () => {
    expect([...STORE_LOG_FIELDS]).toEqual([
      'storeId',
      'shopDomain',
      'authKind',
      'expiresAt',
      'kind',
      'reason',
      'attempt',
      'delayMs',
      'status',
      'durationMs',
      'errorName',
    ]);
  });

  it.each([...STORE_LOG_FIELDS, STORE_LOG_EVENT_KEY])(
    '%s is not printed as a secret key',
    (name) => {
      expect(isSecretKeyName(name)).toBe(false);
    },
  );

  it('contain none of the redaction substrings', () => {
    for (const name of STORE_LOG_FIELDS) {
      expect(name.toLowerCase()).not.toMatch(
        /authorization|cookie|token|secret|password|signature|credential/,
      );
    }
  });

  it('do not include hasCredentials, which would print as redacted', () => {
    expect(STORE_LOG_FIELDS).not.toContain('hasCredentials');
    expect(isSecretKeyName('hasCredentials')).toBe(true);
    expect(isDeclaredStoreLogField('hasCredentials')).toBe(false);
  });

  it('accepts the event key and rejects an undeclared name', () => {
    expect(isDeclaredStoreLogField('event')).toBe(true);
    expect(isDeclaredStoreLogField('message')).toBe(false);
    expect(isDeclaredStoreLogField('accessToken')).toBe(false);
  });
});
