import { describe, expect, it } from 'vitest';
import { es } from '../../i18n/es';
import { verification } from '../../test-fixtures';
import { render } from '../ui-render';
import { VerificationPanel } from './VerificationPanel';

const base = {
  connected: false,
  running: false,
  verification: null,
  failureMessage: null,
  onVerify: () => undefined,
};

describe('VerificationPanel', () => {
  it('offers to verify a store that is not connected', () => {
    const html = render(VerificationPanel, base);
    expect(html).toContain(es.verification.notConnected);
    expect(html).toContain(es.verification.verify);
    expect(html).not.toContain(es.verification.connected);
  });

  it('shows a connected store and offers to verify again', () => {
    const html = render(VerificationPanel, { ...base, connected: true });
    expect(html).toContain(es.verification.connected);
    expect(html).toContain(es.verification.verifyAgain);
  });

  it('disables the button and says so while verifying', () => {
    const html = render(VerificationPanel, { ...base, running: true });
    expect(html).toContain(es.verification.verifying);
    expect(html).toContain('aria-busy="true"');
  });

  it('lists the problems and the missing scopes in Spanish', () => {
    const html = render(VerificationPanel, {
      ...base,
      verification: verification({
        ok: false,
        scopes: { granted: [], required: [], missing: ['write_products', 'write_files'] },
        problems: [{ kind: 'SCOPE_MISSING', code: 'SCOPE_MISSING', params: {} }],
      }),
    });
    expect(html).toContain(es.verification.problems.SCOPE_MISSING);
    expect(html).toContain(es.verification.missingScopes);
    expect(html).toContain('write_products');
    expect(html).toContain('write_files');
    expect(html).toContain('role="alert"');
  });

  it('explains an authentication failure without scopes', () => {
    const html = render(VerificationPanel, {
      ...base,
      verification: verification({
        ok: false,
        problems: [{ kind: 'AUTH_FAILED', code: 'AUTH_FAILED', params: {} }],
      }),
    });
    expect(html).toContain(es.verification.problems.AUTH_FAILED);
    expect(html).not.toContain(es.verification.missingScopes);
  });

  it('shows a verification that could not be made, as an alert', () => {
    const html = render(VerificationPanel, { ...base, failureMessage: es.errors.network });
    expect(html).toContain(es.errors.network);
    expect(html).toContain('role="alert"');
  });
});
