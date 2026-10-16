import { describe, expect, it } from 'vitest';
import { es } from '../../i18n/es';
import { render, textOf } from '../ui-render';
import { StoreStep, type StoreStepProps } from './StoreStep';

const noop = () => undefined;
const base: StoreStepProps = {
  loading: false,
  listError: null,
  stores: [],
  onSelect: noop,
  onReload: noop,
  creating: false,
  createError: null,
  createdNotice: false,
  onCreate: noop,
  selected: null,
  verifying: false,
  verification: null,
  verifyError: null,
  onVerify: noop,
  replacing: false,
  replaceError: null,
  replacedNotice: false,
  onReplace: noop,
};

describe('StoreStep', () => {
  it('shows a loading status while the list is read', () => {
    const html = render(StoreStep, { ...base, loading: true });
    expect(html).toContain(es.stores.loading);
    expect(html).not.toContain(es.stores.empty);
  });

  it('says there are no stores and offers the create form with the token kind first', () => {
    const html = render(StoreStep, base);
    expect(textOf(html)).toContain(es.stores.empty);
    expect(html).toContain(es.stores.createHeading);
    expect(html).toContain(es.stores.displayName);
    expect(html).toContain(es.stores.domainLabel);
    expect(html).toContain(es.stores.accessToken);
    expect(html).toContain(es.stores.authKinds.client_credentials);
    expect(html).not.toContain(es.stores.clientSecret);
  });

  it('shows a list error with a retry button', () => {
    const html = render(StoreStep, { ...base, listError: es.errors.network });
    expect(html).toContain(es.errors.network);
    expect(html).toContain(es.common.retry);
    expect(html).toContain('role="alert"');
  });

  it('shows no verification until a store is chosen', () => {
    expect(render(StoreStep, base)).not.toContain(es.verification.heading);
  });

  it('offers verification and credential replacement for the chosen store', () => {
    const html = render(StoreStep, {
      ...base,
      stores: [
        {
          id: 'a',
          displayName: 'Mi tienda',
          shopDomain: 'mi-tienda.myshopify.com',
          status: 'UNVERIFIED',
          selected: true,
        },
      ],
      selected: { displayName: 'Mi tienda', connected: false },
    });
    expect(html).toContain(es.stores.selectedName('Mi tienda'));
    expect(html).toContain(es.verification.verify);
    expect(html).toContain(es.stores.replaceHeading);
  });

  it('shows creation errors and the created notice', () => {
    const html = render(StoreStep, {
      ...base,
      createError: es.errors.api.STORE_ALREADY_EXISTS,
    });
    expect(html).toContain(es.errors.api.STORE_ALREADY_EXISTS);
    const created = render(StoreStep, {
      ...base,
      createdNotice: true,
      selected: { displayName: 'Mi tienda', connected: false },
    });
    expect(created).toContain(es.stores.created);
  });

  it('disables the create button while saving', () => {
    const html = render(StoreStep, { ...base, creating: true });
    expect(html).toContain(es.stores.creating);
    expect(html).toContain('aria-busy="true"');
  });
});
