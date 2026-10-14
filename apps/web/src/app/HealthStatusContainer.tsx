import { HealthBadge } from '../ui/molecules/HealthBadge';
import { useHealth } from './useHealth';

// Container: owns the data (through the hook) and hands plain props to the presentational badge.
export function HealthStatusContainer() {
  const { state, shopifyApiVersion } = useHealth();
  return <HealthBadge state={state} version={shopifyApiVersion} />;
}
