/**
 * The logging surface the application depends on. The method set mirrors the NestJS
 * `LoggerService` interface (log, error, warn, debug, verbose, fatal), so an implementation is
 * structurally assignable to it without this layer importing the framework.
 */
export interface LoggerPort {
  log(message: unknown, ...optionalParams: unknown[]): void;
  error(message: unknown, ...optionalParams: unknown[]): void;
  warn(message: unknown, ...optionalParams: unknown[]): void;
  debug(message: unknown, ...optionalParams: unknown[]): void;
  verbose(message: unknown, ...optionalParams: unknown[]): void;
  fatal(message: unknown, ...optionalParams: unknown[]): void;
}
