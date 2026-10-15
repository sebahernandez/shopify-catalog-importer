export type CappedBody =
  { readonly kind: 'text'; readonly text: string } | { readonly kind: 'oversize' };

/**
 * Reads a body through a byte counter. Past the cap the stream is cancelled and the rest is
 * never buffered, so memory stays within the cap plus one chunk. Read errors propagate.
 */
export const readCappedBody = async (
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<CappedBody> => {
  if (body === null) return { kind: 'text', text: '' };
  const reader = body.getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { kind: 'oversize' };
    }
    parts.push(value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.byteLength;
  }
  return { kind: 'text', text: new TextDecoder().decode(joined) };
};
