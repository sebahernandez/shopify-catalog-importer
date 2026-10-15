/** Default effects of the gateway client; tests inject deterministic replacements (design D9). */
export const defaultGatewayRuntime = {
  sleep: (ms: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
  random: (): number => Math.random(),
  timeoutSignal: (ms: number): AbortSignal => AbortSignal.timeout(ms),
  nowMs: (): number => Date.now(),
};
