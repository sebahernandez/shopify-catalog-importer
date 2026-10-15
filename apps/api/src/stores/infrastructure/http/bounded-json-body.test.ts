import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { StoreRequestInvalidError } from '../../application/store-errors.js';
import {
  MAX_JSON_BODY_BYTES,
  readBoundedJsonBody,
  type JsonBodySource,
} from './bounded-json-body.js';

function source(chunks: (string | Buffer)[], contentType: string | null = 'application/json') {
  const stream = Readable.from(chunks.map((chunk) => Buffer.from(chunk)));
  return Object.assign(stream, {
    headers: contentType === null ? {} : { 'content-type': contentType },
  }) as JsonBodySource;
}

describe('readBoundedJsonBody', () => {
  it('parses a JSON object split across chunks', async () => {
    await expect(readBoundedJsonBody(source(['{"a":', '1}']))).resolves.toEqual({ a: 1 });
  });

  it('accepts a charset parameter and a +json type', async () => {
    await expect(
      readBoundedJsonBody(source(['{}'], 'application/json; charset=utf-8')),
    ).resolves.toEqual({});
    await expect(readBoundedJsonBody(source(['{}'], 'application/vnd.x+json'))).resolves.toEqual(
      {},
    );
  });

  it('gives undefined for an empty body, whatever the type', async () => {
    await expect(readBoundedJsonBody(source([], null))).resolves.toBeUndefined();
  });

  it('accepts a body of exactly the cap and rejects one byte more', async () => {
    const pad = (n: number) => `"${'x'.repeat(n - 2)}"`;
    await expect(readBoundedJsonBody(source([pad(MAX_JSON_BODY_BYTES)]))).resolves.toBeTypeOf(
      'string',
    );
    await expect(
      readBoundedJsonBody(source([pad(MAX_JSON_BODY_BYTES + 1)])),
    ).rejects.toBeInstanceOf(StoreRequestInvalidError);
  });

  it('drains an oversize stream before answering', async () => {
    const stream = source(Array.from({ length: 6 }, () => 'x'.repeat(4)));
    await expect(readBoundedJsonBody(stream, 10)).rejects.toBeInstanceOf(StoreRequestInvalidError);
    expect(stream.readableEnded).toBe(true);
  });

  it.each([
    ['malformed JSON', ['{"a": canary-json-1'], 'application/json'],
    ['a text type', ['{}'], 'text/plain'],
    ['a missing type', ['{}'], null],
    ['invalid UTF-8', [Buffer.from([0x7b, 0xff, 0x7d])], 'application/json'],
  ])('rejects %s with the fixed error and no parser message', async (_label, chunks, type) => {
    const error: unknown = await readBoundedJsonBody(source(chunks, type)).catch(
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(StoreRequestInvalidError);
    expect((error as Error).message).toBe('The request is not valid.');
    expect(String((error as Error).message)).not.toContain('canary');
    expect((error as Error).cause).toBeUndefined();
  });
});
