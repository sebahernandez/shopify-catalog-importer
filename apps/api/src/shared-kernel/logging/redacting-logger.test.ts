import { afterEach, describe, expect, it, vi } from 'vitest';
import { REDACTED, clearRegisteredSecretsForTests, registerSecret } from './redact.js';
import { RedactingLogger, type LoggerOptions } from './redacting-logger.js';

// Every secret below is an obviously synthetic placeholder, never a real credential.
const FAKE_TOKEN = 'shpat_seed123';
const FAKE_KEY = 'synthetic-encryption-key-0001';
const FIXED_TIME = new Date('2026-01-02T03:04:05.000Z');

function setup(options: Partial<LoggerOptions> = {}) {
  const lines: string[] = [];
  const logger = new RedactingLogger({
    sink: (line) => lines.push(line),
    now: () => FIXED_TIME,
    ...options,
  });
  return { logger, lines };
}

function lastEvent(lines: string[]): Record<string, unknown> {
  return JSON.parse(lines.at(-1) ?? 'null') as Record<string, unknown>;
}

afterEach(() => {
  clearRegisteredSecretsForTests();
  vi.restoreAllMocks();
});

describe('RedactingLogger: line shape', () => {
  it('emits one JSON line per event with the injected time, level and message', () => {
    const { logger, lines } = setup();
    logger.log('first');
    logger.warn('second', { count: 3 });
    expect(lines).toHaveLength(2);
    expect(lastEvent(lines.slice(0, 1))).toEqual({
      time: '2026-01-02T03:04:05.000Z',
      level: 'info',
      message: 'first',
    });
    expect(lastEvent(lines)).toEqual({
      time: '2026-01-02T03:04:05.000Z',
      level: 'warn',
      message: 'second',
      params: [{ count: 3 }],
    });
  });

  it('keeps a non-secret field value in the line', () => {
    const { logger, lines } = setup();
    logger.log('imported', { count: 3 });
    expect(lines[0]).toContain('"count":3');
  });

  it.each([
    ['log', 'info'],
    ['verbose', 'debug'],
    ['debug', 'debug'],
    ['warn', 'warn'],
    ['error', 'error'],
    ['fatal', 'error'],
  ] as const)('maps %s to level %s', (method, level) => {
    const { logger, lines } = setup({ level: 'debug' });
    logger[method]('m');
    expect(lastEvent(lines).level).toBe(level);
  });

  it.each([
    ['one embedded newline', 'a\nb'],
    ['carriage returns and tabs', 'a\r\nb\tc'],
  ])('keeps one line for %s in the message', (_name, message) => {
    const { logger, lines } = setup();
    logger.log(message);
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toMatch(/[\r\n]/);
    expect(lastEvent(lines).message).toBe(message);
  });

  it('keeps one line for a multi-line stack trace', () => {
    const { logger, lines } = setup();
    const error = new Error('boom');
    error.stack = 'Error: boom\n    at first\n    at second';
    logger.error(error);
    expect(lines[0]).not.toMatch(/[\r\n]/);
    expect(JSON.stringify(lastEvent(lines))).toContain('at second');
  });
});

describe('RedactingLogger: level filtering', () => {
  it.each([
    ['error', ['error']],
    ['warn', ['error', 'warn']],
    ['info', ['error', 'warn', 'info']],
    ['debug', ['error', 'warn', 'info', 'debug']],
  ] as const)('with level %s emits only %j', (level, expected) => {
    const { logger, lines } = setup({ level });
    logger.error('e');
    logger.warn('w');
    logger.log('i');
    logger.debug('d');
    expect(lines.map((line) => (JSON.parse(line) as { level: string }).level)).toEqual(expected);
  });

  it('defaults to info', () => {
    const { logger, lines } = setup();
    logger.debug('hidden');
    logger.log('shown');
    expect(lines).toHaveLength(1);
  });

  it('does not build or redact an event that is filtered out', () => {
    const { logger, lines } = setup({ level: 'error' });
    const toJSON = vi.fn(() => 'x');
    logger.debug({ toJSON });
    expect(toJSON).not.toHaveBeenCalled();
    expect(lines).toHaveLength(0);
  });
});

describe('RedactingLogger: secrets never reach the sink', () => {
  it('removes a seeded token from a structured field', () => {
    const { logger, lines } = setup();
    logger.log('call', { accessToken: FAKE_TOKEN, nested: { note: FAKE_TOKEN } });
    expect(lines[0]).not.toContain(FAKE_TOKEN);
    expect(lines[0]).toContain(REDACTED);
  });

  it('removes a seeded token when the message itself is an object', () => {
    const { logger, lines } = setup();
    logger.log({ accessToken: FAKE_TOKEN });
    expect(lines[0]).not.toContain(FAKE_TOKEN);
  });

  it('removes a registered key from a string message', () => {
    registerSecret(FAKE_KEY);
    const { logger, lines } = setup();
    logger.log(`loaded ${FAKE_KEY} ok`);
    expect(lines[0]).not.toContain(FAKE_KEY);
    expect(lastEvent(lines).message).toBe(`loaded ${REDACTED} ok`);
  });

  it('removes a registered key from string optional parameters', () => {
    registerSecret(FAKE_KEY);
    const { logger, lines } = setup();
    logger.warn('context', `extra ${FAKE_KEY}`, 'ctx');
    expect(lines[0]).not.toContain(FAKE_KEY);
  });

  it('removes a registered key from the stack argument of error()', () => {
    registerSecret(FAKE_KEY);
    const { logger, lines } = setup();
    logger.error('failed', `Error: ${FAKE_KEY}\n    at somewhere`, 'Importer');
    expect(lines[0]).not.toContain(FAKE_KEY);
    expect(lastEvent(lines).params).toEqual([`Error: ${REDACTED}\n    at somewhere`, 'Importer']);
  });

  it('removes a secret from an Error passed as message, parameter or cause', () => {
    registerSecret(FAKE_KEY);
    const { logger, lines } = setup();
    const error = new Error(`bad ${FAKE_KEY}`, { cause: new Error(`inner ${FAKE_KEY}`) });
    logger.error(error);
    logger.error('wrapped', error);
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).not.toContain(FAKE_KEY);
  });

  it('removes a shopify-shaped token from free text without registration', () => {
    const { logger, lines } = setup();
    logger.log(`header was ${FAKE_TOKEN}`);
    expect(lines[0]).not.toContain(FAKE_TOKEN);
  });

  it('removes a registered key held inside a Map or Set parameter', () => {
    registerSecret(FAKE_KEY);
    const { logger, lines } = setup();
    logger.log('m', new Map([['k', FAKE_KEY]]), new Set([FAKE_KEY]));
    expect(lines[0]).not.toContain(FAKE_KEY);
  });
});

describe('RedactingLogger: never throws into the caller', () => {
  it('swallows a throwing sink, counts the dropped event and writes nowhere else', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const logger = new RedactingLogger({
      sink: () => {
        throw new Error(`sink failed ${FAKE_TOKEN}`);
      },
      now: () => FIXED_TIME,
    });
    expect(() => logger.log('a', { accessToken: FAKE_TOKEN })).not.toThrow();
    expect(() => logger.error('b')).not.toThrow();
    expect(logger.droppedEvents).toBe(2);
    expect(stderr).not.toHaveBeenCalled();
    expect(stdout).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('keeps logging after the sink recovers', () => {
    const lines: string[] = [];
    let failing = true;
    const logger = new RedactingLogger({
      sink: (line) => {
        if (failing) throw new Error('down');
        lines.push(line);
      },
      now: () => FIXED_TIME,
    });
    logger.log('lost');
    failing = false;
    logger.log('kept');
    expect(lines).toHaveLength(1);
    expect(logger.droppedEvents).toBe(1);
  });

  it('serialises a BigInt as a string', () => {
    const { logger, lines } = setup();
    logger.log('big', { total: 12n });
    expect(lastEvent(lines).params).toEqual([{ total: '12' }]);
  });

  it('serialises a cyclic structure', () => {
    const { logger, lines } = setup();
    const loop: Record<string, unknown> = { name: 'loop' };
    loop.self = loop;
    logger.log('cycle', loop);
    expect(lastEvent(lines).params).toEqual([{ name: 'loop', self: '[Circular]' }]);
  });

  it('survives a throwing toJSON without leaking its content', () => {
    const { logger, lines } = setup();
    const hostile = {
      toJSON() {
        throw new Error(FAKE_TOKEN);
      },
    };
    expect(() => logger.log('hostile', hostile)).not.toThrow();
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(FAKE_TOKEN);
  });

  it('survives a throwing getter and a throwing clock', () => {
    const lines: string[] = [];
    const logger = new RedactingLogger({
      sink: (line) => lines.push(line),
      now: () => {
        throw new Error('no clock');
      },
    });
    const getter = {
      get value(): string {
        throw new Error('no read');
      },
    };
    expect(() => logger.log('x', getter)).not.toThrow();
    expect(logger.droppedEvents + lines.length).toBe(1);
  });

  it('accepts no arguments and unexpected types', () => {
    const { logger, lines } = setup();
    const untyped = logger as unknown as Record<string, (...args: unknown[]) => void>;
    expect(() => untyped.log?.()).not.toThrow();
    expect(() => logger.log(null, undefined, Symbol('s'), () => 1, 7, true)).not.toThrow();
    expect(() => logger.error(Object.create(null) as object)).not.toThrow();
    expect(lines).toHaveLength(3);
    for (const line of lines) expect(typeof JSON.parse(line)).toBe('object');
  });
});
