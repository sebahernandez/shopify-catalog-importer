import { describe, expect, it } from 'vitest';
import { es } from '../../i18n/es';
import { render } from '../ui-render';
import { CredentialsForm } from './CredentialsForm';

const base = {
  withIdentity: true,
  idPrefix: 'create',
  submitLabel: es.stores.create,
  busyLabel: es.stores.creating,
  busy: false,
  onSubmit: () => undefined,
};

describe('CredentialsForm', () => {
  it('asks for name, domain and a token, with unique ids', () => {
    const html = render(CredentialsForm, base);
    for (const id of ['create-name', 'create-domain', 'create-token']) {
      expect(html.match(new RegExp(`id="${id}"`, 'g'))).toHaveLength(1);
    }
    expect(html).toContain('type="password"');
    expect(html).toContain('checked=""');
  });

  it('asks for credentials only in the replace form', () => {
    const html = render(CredentialsForm, { ...base, withIdentity: false, idPrefix: 'replace' });
    expect(html).not.toContain(es.stores.displayName);
    expect(html).toContain('replace-token');
  });

  it('disables every field while saving', () => {
    const html = render(CredentialsForm, { ...base, busy: true });
    expect(html).toContain(es.stores.creating);
    expect(html.match(/<input[^>]*disabled=""/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain('<fieldset');
  });
});
