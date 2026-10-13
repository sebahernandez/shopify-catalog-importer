export type MoneyErrorCode =
  'AMBIGUOUS_SEPARATOR' | 'INVALID_FORMAT' | 'INVALID_SCALE' | 'SCALE_EXCEEDED';

/** Raised for rejected input. Messages are fixed text and never echo the rejected value. */
export class MoneyError extends Error {
  readonly code: MoneyErrorCode;

  constructor(code: MoneyErrorCode, message: string) {
    super(message);
    this.name = 'MoneyError';
    this.code = code;
  }
}

export type MoneyResult = { ok: true; value: Money } | { ok: false; error: MoneyError };

/** Optional minus sign, ASCII digits, and an optional `.` followed by ASCII digits. */
const ACCEPTED = /^-?[0-9]+(\.[0-9]+)?$/;
/** Only digits and separators, with at least one comma: a thousands or comma-decimal style. */
const COMMA_STYLE = /^-?[0-9.,]+$/;

const TEN = 10n;

function powerOfTen(exponent: number): bigint {
  return TEN ** BigInt(exponent);
}

/**
 * Immutable decimal amount stored as an unscaled `bigint` plus a scale. No floating-point
 * arithmetic is used anywhere. The stored scale is always the significant one (no trailing
 * fraction zeros), so equal values have identical state and identical string output.
 */
export class Money {
  /** Number of significant fraction digits. */
  readonly scale: number;
  readonly #unscaled: bigint;

  private constructor(unscaled: bigint, scale: number) {
    let digits = unscaled;
    let places = scale;
    while (places > 0 && digits % TEN === 0n) {
      digits /= TEN;
      places -= 1;
    }
    this.#unscaled = digits;
    this.scale = digits === 0n ? 0 : places;
    Object.freeze(this);
  }

  static parse(input: string): Money {
    if (typeof input !== 'string') {
      throw new MoneyError('INVALID_FORMAT', 'Amount must be a string.');
    }
    if (input.includes(',') && COMMA_STYLE.test(input)) {
      throw new MoneyError(
        'AMBIGUOUS_SEPARATOR',
        'Amount uses a comma; only "." is accepted as the decimal separator.',
      );
    }
    if (!ACCEPTED.test(input)) {
      throw new MoneyError('INVALID_FORMAT', 'Amount is not a valid decimal string.');
    }
    const negative = input.startsWith('-');
    const unsigned = negative ? input.slice(1) : input;
    const [whole = '', fraction = ''] = unsigned.split('.');
    const magnitude = BigInt(whole + fraction);
    return new Money(negative ? -magnitude : magnitude, fraction.length);
  }

  static tryParse(input: unknown): MoneyResult {
    try {
      return { ok: true, value: Money.parse(input as string) };
    } catch (error) {
      if (error instanceof MoneyError) {
        return { ok: false, error };
      }
      throw error;
    }
  }

  isNegative(): boolean {
    return this.#unscaled < 0n;
  }

  add(other: Money): Money {
    const scale = Math.max(this.scale, other.scale);
    return new Money(this.#alignedTo(scale) + other.#alignedTo(scale), scale);
  }

  equals(other: Money): boolean {
    return this.compare(other) === 0;
  }

  compare(other: Money): -1 | 0 | 1 {
    const scale = Math.max(this.scale, other.scale);
    const left = this.#alignedTo(scale);
    const right = other.#alignedTo(scale);
    if (left < right) {
      return -1;
    }
    return left > right ? 1 : 0;
  }

  /** Pads the canonical string to exactly `places` fraction digits; never rounds. */
  toFixed(places: number): string {
    if (!Number.isSafeInteger(places) || places < 0) {
      throw new MoneyError('INVALID_SCALE', 'Scale must be a non-negative integer.');
    }
    if (this.scale > places) {
      throw new MoneyError('SCALE_EXCEEDED', 'Amount has more fraction digits than requested.');
    }
    if (places === 0) {
      return this.toString();
    }
    const [whole = '', fraction = ''] = this.toString().split('.');
    return `${whole}.${fraction.padEnd(places, '0')}`;
  }

  toString(): string {
    const negative = this.#unscaled < 0n;
    const digits = (negative ? -this.#unscaled : this.#unscaled).toString();
    const sign = negative ? '-' : '';
    if (this.scale === 0) {
      return sign + digits;
    }
    const padded = digits.padStart(this.scale + 1, '0');
    const cut = padded.length - this.scale;
    return `${sign}${padded.slice(0, cut)}.${padded.slice(cut)}`;
  }

  toJSON(): string {
    return this.toString();
  }

  #alignedTo(scale: number): bigint {
    return this.#unscaled * powerOfTen(scale - this.scale);
  }
}
