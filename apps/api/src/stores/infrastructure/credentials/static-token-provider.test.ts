import { describe, expect, it, vi } from 'vitest';
import type { CredentialProvider } from '../../ports/credential-provider.port.js';
import { StaticTokenProvider } from './static-token-provider.js';

const TOKEN = 'synthetic-access-token-0008';

describe('StaticTokenProvider', () => {
  it('is the static_token kind and returns the token with no request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('no network'));
    try {
      const provider = new StaticTokenProvider(TOKEN);
      expect(provider.authKind).toBe('static_token');
      await expect(provider.accessToken()).resolves.toBe(TOKEN);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('cannot renew a rejected token', async () => {
    const provider: CredentialProvider = new StaticTokenProvider(TOKEN);
    await expect(provider.refreshAfterRejection(TOKEN)).resolves.toBeNull();
  });
});
