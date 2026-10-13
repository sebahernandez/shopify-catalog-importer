import type { LoggerPort } from './logger.port.js';
import { redact, redactString } from './redact.js';

/** Severity names accepted by the `LOG_LEVEL` setting, from most to least severe. */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const SEVERITY: Record<LogLevel, number> = { error: 0, warn: 1, info: 2, debug: 3 };

export interface LoggerOptions {
  /** Receives one finished JSON line (no trailing newline). It may throw; the logger copes. */
  readonly sink: (line: string) => void;
  /** Most verbose level that is still emitted. Defaults to `info`. */
  readonly level?: LogLevel;
  /** Clock, injectable so tests are deterministic. Defaults to the system clock. */
  readonly now?: () => Date;
}

/** BigInt is the one value JSON cannot carry; it becomes a string (still redacted). */
function jsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? redactString(value.toString()) : value;
}

/**
 * Writes one JSON line per event to an injected sink. Every message and optional parameter goes
 * through `redact()` before it is serialised, so a secret never reaches the sink. Logging never
 * throws into the caller: if the event cannot be built or the sink fails, the event is dropped
 * and counted in `droppedEvents`. Nothing is written anywhere else, because any fallback channel
 * would have to be trusted with the same data.
 */
export class RedactingLogger implements LoggerPort {
  private dropped = 0;
  private readonly sink: (line: string) => void;
  private readonly threshold: number;
  private readonly now: () => Date;

  constructor(options: LoggerOptions) {
    this.sink = options.sink;
    this.threshold = SEVERITY[options.level ?? 'info'];
    this.now = options.now ?? (() => new Date());
  }

  /** Events lost because the sink threw or the event could not be built. */
  get droppedEvents(): number {
    return this.dropped;
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('debug', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('error', message, optionalParams);
  }

  private emit(level: LogLevel, message: unknown, params: unknown[]): void {
    if (SEVERITY[level] > this.threshold) return;
    try {
      const event = {
        time: this.now().toISOString(),
        level,
        message: redact(message),
        params: params.length > 0 ? redact(params) : undefined,
      };
      this.sink(JSON.stringify(event, jsonReplacer));
    } catch {
      this.dropped += 1;
    }
  }
}
