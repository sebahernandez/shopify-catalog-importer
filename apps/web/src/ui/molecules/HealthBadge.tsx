import type { HealthState } from '../../health-state';
import { es } from '../../i18n/es';
import { StatusDot, type StatusTone } from '../atoms/StatusDot';

interface HealthBadgeProps {
  readonly state: HealthState;
  /** Plain text. React escapes it; it is never interpreted as markup. */
  readonly version?: string | undefined;
}

const DOT_TONE: Record<HealthState, StatusTone> = {
  loading: 'neutral',
  ok: 'success',
  degraded: 'warning',
  unreachable: 'danger',
};

const LABEL_CLASSES: Record<HealthState, string> = {
  loading: 'text-base font-medium text-gray-700',
  ok: 'text-base font-medium text-green-800',
  degraded: 'text-base font-medium text-amber-900',
  unreachable: 'text-base font-medium text-red-800',
};

// role="status" is a polite live region: a change from loading to a result is announced without
// moving focus. Every state has a visible text label, so colour is never the only signal.
export function HealthBadge({ state, version }: HealthBadgeProps) {
  return (
    <div role="status" className="flex flex-col gap-1 rounded-md border border-gray-300 p-4">
      <div className="flex items-center gap-2">
        <StatusDot tone={DOT_TONE[state]} />
        <p className={LABEL_CLASSES[state]}>{es.health.states[state]}</p>
      </div>
      {version === undefined ? null : (
        <p className="text-sm text-gray-600">{es.health.version(version)}</p>
      )}
    </div>
  );
}
