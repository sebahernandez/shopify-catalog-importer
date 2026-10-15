import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Readable } from 'node:stream';
import { StoreRequestInvalidError } from '../../application/store-errors.js';

/** Store bodies are a few hundred bytes; 16 KB is generous and bounds memory (design D21). */
export const MAX_JSON_BODY_BYTES = 16 * 1024;

/** The request members the reader uses; an Express request provides both. */
export type JsonBodySource = Readable & {
  readonly headers: { 'content-length'?: string; 'content-type'?: string };
};

const isJsonType = (value: string | undefined): boolean =>
  /^application\/(?:[a-z0-9.+-]+\+)?json\s*(?:;|$)/i.test(value ?? '');

/**
 * Reads the request body once, keeping at most `maxBytes`, and parses it as JSON. Every failure
 * (too large, wrong content type, bad UTF-8, bad JSON) is the same `StoreRequestInvalidError`
 * with a fixed message: the parser's own message can quote the body, so it is never kept. An empty
 * body gives `undefined`, which the request parsing then rejects as a missing body.
 */
export async function readBoundedJsonBody(
  request: JsonBodySource,
  maxBytes: number = MAX_JSON_BODY_BYTES,
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  let overflow = false;
  for await (const chunk of request) {
    const piece = chunk as Buffer;
    size += piece.byteLength;
    if (size > maxBytes) {
      overflow = true;
      chunks.length = 0;
      continue;
    }
    chunks.push(piece);
  }
  if (overflow) throw new StoreRequestInvalidError();
  if (size === 0) return undefined;
  if (!isJsonType(request.headers['content-type'])) throw new StoreRequestInvalidError();
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    return JSON.parse(text) as unknown;
  } catch {
    throw new StoreRequestInvalidError();
  }
}

/** The JSON body of the request, read within the bound; use in place of `@Body()`. */
export const JsonBody = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  readBoundedJsonBody(context.switchToHttp().getRequest<JsonBodySource>()),
);
