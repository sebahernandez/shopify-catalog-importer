import { describe, expect, it } from 'vitest';
import type { Clock } from './clock.port.js';
import { SystemClock } from './system-clock.js';

describe('SystemClock', () => {
  it('reads the wall clock in milliseconds', () => {
    const before = Date.now();
    const now = new SystemClock().nowMs();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThan(before + 1000);
  });

  it('accepts a fake object as a Clock', () => {
    const fake: Clock = { nowMs: () => 42 };
    expect(fake.nowMs()).toBe(42);
  });
});
