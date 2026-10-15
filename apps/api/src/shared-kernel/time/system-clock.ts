import type { Clock } from './clock.port.js';

/** The wall clock. */
export class SystemClock implements Clock {
  nowMs(): number {
    return Date.now();
  }
}
