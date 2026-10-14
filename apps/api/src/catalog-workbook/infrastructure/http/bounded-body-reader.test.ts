import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { readBoundedBody, UploadRejection, type BodySource } from './bounded-body-reader.js';

// Task 13.2: the body reader on its own, over in-memory streams.
function source(chunks: Buffer[], headers: BodySource['headers'] = {}) {
  let consumed = 0;
  const stream = Readable.from(
    (function* () {
      for (const chunk of chunks) {
        consumed += 1;
        yield chunk;
      }
    })(),
  );
  return { request: Object.assign(stream, { headers }) as BodySource, consumed: () => consumed };
}

const rejection = async (promise: Promise<unknown>): Promise<UploadRejection> => {
  const error: unknown = await promise.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(UploadRejection);
  return error as UploadRejection;
};

describe('readBoundedBody', () => {
  it('returns exactly the received bytes with their SHA-256 from one pass', async () => {
    const body = [Buffer.from('known '), Buffer.from('body')];
    const { request } = source(body);
    const read = await readBoundedBody(request, 1024);
    expect(Buffer.from(read.bytes).toString('utf8')).toBe('known body');
    expect(read.sha256).toBe(createHash('sha256').update('known body').digest('hex'));
  });

  it('accepts a body of exactly the cap', async () => {
    const read = await readBoundedBody(source([Buffer.alloc(8, 1)]).request, 8);
    expect(read.bytes.byteLength).toBe(8);
  });

  it('stops storing at the cap, drains the rest and answers 413', async () => {
    const chunks = Array.from({ length: 6 }, () => Buffer.alloc(4, 7));
    const { request, consumed } = source(chunks);
    const error = await rejection(readBoundedBody(request, 10));
    expect(error).toMatchObject({
      status: 413,
      code: 'WORKBOOK_TOO_LARGE',
      closeConnection: false,
    });
    expect(consumed()).toBe(6);
  });

  it('answers a Content-Length over the cap at once, without reading and closing the connection', async () => {
    const { request, consumed } = source([Buffer.alloc(4)], { 'content-length': '11' });
    const error = await rejection(readBoundedBody(request, 10));
    expect(error).toMatchObject({ status: 413, code: 'WORKBOOK_TOO_LARGE', closeConnection: true });
    expect(consumed()).toBe(0);
  });

  it('answers a zero-byte body with the file-required error', async () => {
    const error = await rejection(readBoundedBody(source([]).request, 10));
    expect(error).toMatchObject({ status: 400, code: 'WORKBOOK_FILE_REQUIRED' });
  });
});
