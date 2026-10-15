import { describe, expect, it } from 'vitest';
import { RandomUuidIdGenerator } from './random-uuid-id-generator.js';

describe('RandomUuidIdGenerator', () => {
  const generator = new RandomUuidIdGenerator();

  it('returns lower case UUID v4 strings', () => {
    const id = generator.next();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(id).toBe(id.toLowerCase());
  });

  it('returns a different id on each call', () => {
    expect(generator.next()).not.toBe(generator.next());
  });
});
