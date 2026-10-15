import { describe, expect, it } from 'vitest';
import { es } from '../../i18n/es';
import { render } from '../ui-render';
import { StoreList, type StoreListItem } from './StoreList';

const item = (over: Partial<StoreListItem> = {}): StoreListItem => ({
  id: 'a',
  displayName: 'Mi tienda',
  shopDomain: 'mi-tienda.myshopify.com',
  status: 'UNVERIFIED',
  selected: false,
  ...over,
});

describe('StoreList', () => {
  it('lists each store with its domain, status text and a select button', () => {
    const html = render(StoreList, {
      stores: [item(), item({ id: 'b', displayName: 'Otra', status: 'CONNECTED' })],
      onSelect: () => undefined,
    });
    expect(html.match(/<li[\s>]/g)).toHaveLength(2);
    expect(html).toContain('Mi tienda');
    expect(html).toContain(es.stores.domain('mi-tienda.myshopify.com'));
    expect(html).toContain(es.stores.statuses.UNVERIFIED);
    expect(html).toContain(es.stores.statuses.CONNECTED);
    expect(html.match(new RegExp(es.stores.select, 'g'))).toHaveLength(2);
  });

  it('marks the chosen store and disables its button', () => {
    const html = render(StoreList, {
      stores: [item({ selected: true })],
      onSelect: () => undefined,
    });
    expect(html).toContain(es.stores.selected);
    expect(html).toContain('disabled=""');
    expect(html).toContain('border-blue-700');
  });

  it('shows a status word for every status, not only a colour', () => {
    for (const status of ['AUTH_FAILED', 'SCOPE_MISSING', 'UNAVAILABLE'] as const) {
      const html = render(StoreList, { stores: [item({ status })], onSelect: () => undefined });
      expect(html).toContain(es.stores.statuses[status]);
    }
  });
});
