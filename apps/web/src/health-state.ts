// The four things the page can say about the API. Shared by the client, the hook and the
// presentational components, so it lives outside all of those layers.
export const HEALTH_STATES = ['loading', 'ok', 'degraded', 'unreachable'] as const;

export type HealthState = (typeof HEALTH_STATES)[number];
