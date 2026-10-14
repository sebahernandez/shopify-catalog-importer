import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import type { ApiError } from '@importer/contracts';

type UploadCode = Extract<
  ApiError['error']['code'],
  'WORKBOOK_FILE_REQUIRED' | 'WORKBOOK_TOO_LARGE' | 'WORKBOOK_UNSUPPORTED_MEDIA_TYPE'
>;

const MESSAGES: Readonly<Record<UploadCode, string>> = {
  WORKBOOK_FILE_REQUIRED: 'a workbook file is required',
  WORKBOOK_TOO_LARGE: 'the upload is larger than the allowed size',
  WORKBOOK_UNSUPPORTED_MEDIA_TYPE: 'the content type is not supported',
};

const STATUSES: Readonly<Record<UploadCode, number>> = {
  WORKBOOK_FILE_REQUIRED: 400,
  WORKBOOK_TOO_LARGE: 413,
  WORKBOOK_UNSUPPORTED_MEDIA_TYPE: 415,
};

/** A request that could not deliver a file (design D7). The message is fixed text per code. */
export class UploadRejection extends Error {
  readonly status: number;

  constructor(
    readonly code: UploadCode,
    /** True when the body was left unread, so the answer must close the connection. */
    readonly closeConnection = false,
  ) {
    super(MESSAGES[code]);
    this.name = 'UploadRejection';
    this.status = STATUSES[code];
  }
}

/** The request members the reader uses; an Express request provides both. */
export type BodySource = Readable & {
  readonly headers: { 'content-length'?: string; 'content-type'?: string };
};

export interface BoundedBody {
  readonly bytes: Buffer;
  /** Lowercase hex SHA-256 of exactly the bytes received (design D13). */
  readonly sha256: string;
}

/**
 * Reads the request body once, keeping at most `maxBytes`. A declared length over the cap is
 * answered before any byte is read. A stream that grows past the cap stops being stored (and
 * hashed) and is drained, so the client gets its answer instead of a broken pipe.
 */
export async function readBoundedBody(request: BodySource, maxBytes: number): Promise<BoundedBody> {
  const declared = Number(request.headers['content-length']);
  if (declared > maxBytes) throw new UploadRejection('WORKBOOK_TOO_LARGE', true);

  const hash = createHash('sha256');
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
    hash.update(piece);
    chunks.push(piece);
  }
  if (overflow) throw new UploadRejection('WORKBOOK_TOO_LARGE');
  if (size === 0) throw new UploadRejection('WORKBOOK_FILE_REQUIRED');
  return { bytes: Buffer.concat(chunks), sha256: hash.digest('hex') };
}
