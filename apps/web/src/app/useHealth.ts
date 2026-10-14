import { useEffect, useState } from 'react';
import { fetchHealth, type HealthResult } from '../api/http-client';
import type { HealthState } from '../health-state';

export interface HealthView {
  readonly state: HealthState;
  readonly shopifyApiVersion?: string;
}

export const INITIAL_HEALTH: HealthView = { state: 'loading' };

/**
 * What a finished request does to the page state: adopt the result, or null to leave the state
 * alone. A request that was aborted because the page went away (or because an effect was re-run,
 * as React does once in development) must not win, and must not touch state at all.
 */
export function resolveHealthView(result: HealthResult, cancelled: boolean): HealthView | null {
  return cancelled ? null : result;
}

/** Asks the API once when the page mounts. No polling and no retry in this slice. */
export function useHealth(): HealthView {
  const [view, setView] = useState<HealthView>(INITIAL_HEALTH);

  useEffect(() => {
    const controller = new AbortController();
    void fetchHealth({ signal: controller.signal }).then((result) => {
      const next = resolveHealthView(result, controller.signal.aborted);
      if (next !== null) setView(next);
    });
    return () => controller.abort();
  }, []);

  return view;
}
