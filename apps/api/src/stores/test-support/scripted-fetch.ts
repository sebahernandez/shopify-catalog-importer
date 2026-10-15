/** One scripted answer: a full response, a streamed body, a rejection, or a call that never resolves. */
export type ScriptStep =
  | { readonly status: number; readonly headers?: Record<string, string>; readonly body?: string }
  | {
      readonly chunks: readonly Uint8Array[];
      readonly status?: number;
      readonly headers?: Record<string, string>;
      /** Number of chunks served before the body hangs until the signal aborts. */
      readonly hangAfter?: number;
    }
  | { readonly throws: unknown }
  | { readonly never: true };

export interface RecordedCall {
  readonly url: string;
  readonly method: string | undefined;
  readonly headers: Record<string, string>;
  readonly body: unknown;
  readonly init: RequestInit;
  pulledBytes: number;
  cancelled: boolean;
}

const abortError = (signal: AbortSignal | null | undefined): Error =>
  (signal?.reason as Error | undefined) ?? new DOMException('aborted', 'AbortError');

const waitForAbort = (signal: AbortSignal | null | undefined): Promise<never> =>
  new Promise((_resolve, reject) => {
    if (signal?.aborted) reject(abortError(signal));
    signal?.addEventListener('abort', () => reject(abortError(signal)), { once: true });
  });

const streamOf = (
  step: Extract<ScriptStep, { chunks: readonly Uint8Array[] }>,
  call: RecordedCall,
  signal: AbortSignal | null | undefined,
): ReadableStream<Uint8Array> => {
  let index = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (step.hangAfter !== undefined && index >= step.hangAfter) await waitForAbort(signal);
      const chunk = step.chunks[index++];
      if (chunk === undefined) return controller.close();
      call.pulledBytes += chunk.byteLength;
      controller.enqueue(chunk);
    },
    cancel() {
      call.cancelled = true;
    },
  });
};

/** A scripted `fetch`: answers in order, records every call, fails the test past the script's end. */
export const scriptedFetch = (steps: readonly ScriptStep[]) => {
  const calls: RecordedCall[] = [];
  const fetch = async (url: string | URL, init: RequestInit = {}): Promise<Response> => {
    const call: RecordedCall = {
      url: String(url),
      method: init.method,
      headers: Object.fromEntries(new Headers(init.headers).entries()),
      body: init.body,
      init,
      pulledBytes: 0,
      cancelled: false,
    };
    calls.push(call);
    const step = steps[calls.length - 1];
    if (step === undefined) throw new Error('scripted fetch called past the end of the script');
    if ('throws' in step) throw step.throws;
    if ('never' in step) return waitForAbort(init.signal);
    const options = { status: step.status ?? 200, ...(step.headers && { headers: step.headers }) };
    return new Response('chunks' in step ? streamOf(step, call, init.signal) : step.body, options);
  };
  return { fetch, calls };
};
