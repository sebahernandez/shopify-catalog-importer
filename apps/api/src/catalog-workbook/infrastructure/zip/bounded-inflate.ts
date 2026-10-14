import { inflateRawSync } from 'node:zlib';

export type BoundedInflate =
  | { readonly ok: true; readonly bytes: Buffer }
  | { readonly ok: false; readonly reason: 'over' | 'corrupt' };

/** Inflates a raw deflate stream and never produces more than `bound` bytes of output. */
export function boundedInflate(data: Buffer, bound: number): BoundedInflate {
  try {
    return { ok: true, bytes: inflateRawSync(data, { maxOutputLength: bound }) };
  } catch (error) {
    const over =
      error instanceof RangeError && 'code' in error && error.code === 'ERR_BUFFER_TOO_LARGE';
    return { ok: false, reason: over ? 'over' : 'corrupt' };
  }
}
