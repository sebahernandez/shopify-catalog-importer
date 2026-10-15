/** Source of the current time, injected so time-dependent rules are testable without timers. */
export interface Clock {
  nowMs(): number;
}
