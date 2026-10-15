import type { StoreStatus } from '@importer/contracts';
import { es } from '../../i18n/es';
import { StatusDot, type StatusTone } from '../atoms/StatusDot';
import { Button } from '../atoms/Button';

export interface StoreListItem {
  readonly id: string;
  readonly displayName: string;
  readonly shopDomain: string;
  readonly status: StoreStatus;
  readonly selected: boolean;
}

const STATUS_TONE: Record<StoreStatus, StatusTone> = {
  UNVERIFIED: 'neutral',
  CONNECTED: 'success',
  AUTH_FAILED: 'danger',
  SCOPE_MISSING: 'warning',
  UNAVAILABLE: 'warning',
};

const ITEM_CLASSES: Record<'selected' | 'plain', string> = {
  selected:
    'flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-blue-700 bg-blue-50 p-3',
  plain: 'flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-300 p-3',
};

interface StoreListProps {
  readonly stores: readonly StoreListItem[];
  readonly onSelect: (id: string) => void;
}

export function StoreList({ stores, onSelect }: StoreListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {stores.map((store) => (
        <li key={store.id} className={ITEM_CLASSES[store.selected ? 'selected' : 'plain']}>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-gray-900">{store.displayName}</p>
            <p className="text-xs text-gray-600">{es.stores.domain(store.shopDomain)}</p>
            <p className="flex items-center gap-2 text-xs text-gray-800">
              <StatusDot tone={STATUS_TONE[store.status]} />
              {es.stores.statuses[store.status]}
            </p>
          </div>
          <Button
            variant="secondary"
            label={store.selected ? es.stores.selected : es.stores.select}
            disabled={store.selected}
            onClick={() => onSelect(store.id)}
          />
        </li>
      ))}
    </ul>
  );
}
