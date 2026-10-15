import { describe, expect, it } from 'vitest';
import { createThrottleTracker } from './throttle-tracker.js';

const status = (currentlyAvailable: number, restoreRate: number, maximumAvailable = 1000) => ({
  maximumAvailable,
  currentlyAvailable,
  restoreRate,
});

const setup = () => {
  let now = 1_000_000;
  const tracker = createThrottleTracker({ nowMs: () => now });
  return { tracker, advance: (ms: number) => (now += ms) };
};

describe('ThrottleTracker', () => {
  it('advises the time the bucket needs to restore, shrinking as time passes', () => {
    const { tracker, advance } = setup();
    tracker.observe('a.myshopify.com', status(100, 50));
    expect(tracker.waitTimeFor('a.myshopify.com', 300)).toBe(4000);
    advance(2000);
    expect(tracker.waitTimeFor('a.myshopify.com', 300)).toBe(2000);
  });

  it('gives 0 when enough is available, and for a store never observed', () => {
    const { tracker } = setup();
    tracker.observe('a.myshopify.com', status(100, 50));
    expect(tracker.waitTimeFor('a.myshopify.com', 80)).toBe(0);
    expect(tracker.waitTimeFor('never.myshopify.com', 500)).toBe(0);
  });

  it('caps the restored amount at the maximum', () => {
    const { tracker, advance } = setup();
    tracker.observe('a.myshopify.com', status(900, 100));
    advance(60_000);
    expect(tracker.waitTimeFor('a.myshopify.com', 1000)).toBe(0);
  });

  it('ignores a malformed cost block and keeps stores independent', () => {
    const { tracker } = setup();
    tracker.observe('a.myshopify.com', status(100, 50));
    tracker.observe('a.myshopify.com', { restoreRate: 'x' });
    tracker.observe('b.myshopify.com', status(500, 50));
    expect(tracker.waitTimeFor('a.myshopify.com', 300)).toBe(4000);
    expect(tracker.waitTimeFor('b.myshopify.com', 300)).toBe(0);
  });

  it('rounds the wait up', () => {
    const { tracker } = setup();
    tracker.observe('a.myshopify.com', status(0, 3));
    expect(tracker.waitTimeFor('a.myshopify.com', 10)).toBe(3334);
  });
});
