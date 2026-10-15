import { describe, expect, it } from 'vitest';
import {
  ALL_CANARIES,
  CANARIES,
  canariesIn,
  canariesInBytes,
  canariesInError,
} from './canaries.js';

describe('the canaries', () => {
  it('are five distinct values', () => {
    expect(Object.keys(CANARIES)).toHaveLength(5);
    expect(new Set(ALL_CANARIES).size).toBe(5);
  });

  it('include a shpat_ token of 32 hex characters and a Bearer string', () => {
    expect(CANARIES.shopifyShaped).toMatch(/^shpat_[0-9a-f]{32}$/);
    expect(CANARIES.bearer).toMatch(/^Bearer \S+$/);
  });

  it('are not substrings of one another', () => {
    // They are values, not keys; the check guards against a canary that doubles as another's prefix.
    for (const a of ALL_CANARIES) {
      for (const b of ALL_CANARIES) if (a !== b) expect(a.includes(b)).toBe(false);
    }
  });
});

describe('canariesIn', () => {
  it('finds each canary in a string', () => {
    for (const canary of ALL_CANARIES) {
      expect(canariesIn(`line before ${canary} line after`)).toContain(canary);
    }
  });

  it('finds the bare credential of the Bearer canary', () => {
    expect(canariesIn('Authorization: canary-bearer-credential-2d4f6a8c0e1b')).toHaveLength(1);
  });

  it('passes clean text', () => {
    expect(canariesIn('{"event":"store_request_failed","errorName":"TypeError"}')).toEqual([]);
    expect(canariesIn('')).toEqual([]);
  });
});

describe('canariesInError', () => {
  it('finds a canary in the message', () => {
    expect(canariesInError(new Error(`failed with ${CANARIES.staticToken}`))).toEqual([
      CANARIES.staticToken,
    ]);
  });

  it('finds a canary in an own property, also a non-enumerable one', () => {
    const plain = Object.assign(new Error('x'), { detail: { url: CANARIES.shopifyShaped } });
    const hidden = new Error('x');
    Object.defineProperty(hidden, 'secret', { value: CANARIES.clientSecret, enumerable: false });
    expect(canariesInError(plain)).toEqual([CANARIES.shopifyShaped]);
    expect(canariesInError(hidden)).toEqual([CANARIES.clientSecret]);
  });

  it('follows a nested cause chain', () => {
    const deep = new Error('inner', { cause: new Error(CANARIES.exchangedToken) });
    expect(
      canariesInError(new Error('outer', { cause: new Error('middle', { cause: deep }) })),
    ).toEqual([CANARIES.exchangedToken]);
  });

  it('survives a cycle and passes a clean error', () => {
    const cyclic = new Error('clean');
    Object.assign(cyclic, { self: cyclic });
    expect(canariesInError(cyclic)).toEqual([]);
    expect(canariesInError('not an error')).toEqual([]);
  });
});

describe('canariesInBytes', () => {
  it('finds a canary inside binary bytes and passes clean bytes', () => {
    const bytes = Buffer.concat([
      Buffer.from([0, 255, 1]),
      Buffer.from(CANARIES.bearer),
      Buffer.from([2, 0]),
    ]);
    expect(canariesInBytes(bytes)).toContain(CANARIES.bearer);
    expect(canariesInBytes(Buffer.from([0, 1, 2, 3, 255]))).toEqual([]);
  });
});
