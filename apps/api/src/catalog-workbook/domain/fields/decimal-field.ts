import { Money } from '../../../shared-kernel/money/money.js';
import type { FieldValue } from '../workbook-cell.js';
import { type FieldResult, cellReason } from './field-result.js';

export type DecimalReason =
  | 'DECIMAL_AMBIGUOUS'
  | 'DECIMAL_INVALID'
  | 'DECIMAL_SCALE_EXCEEDED'
  | 'DECIMAL_MAGNITUDE_EXCEEDED'
  | 'PRICE_NEGATIVE';

const MAX_SCALE = 4;
const MAGNITUDE_LIMIT = Money.parse('1000000000000');
const ZERO = Money.parse('0');

/** Text or a number cell's stored text becomes `Money`; nothing is ever rounded. */
export function parseDecimal(cell: FieldValue): FieldResult<Money, DecimalReason, 'PRICE_ZERO'> {
  if (cell.kind === 'empty') {
    return { ok: true, value: undefined };
  }
  if (cell.kind !== 'text' && cell.kind !== 'number') {
    return { ok: false, reason: cellReason(cell) };
  }
  const parsed = Money.tryParse(cell.kind === 'text' ? cell.text : cell.raw);
  if (!parsed.ok) {
    return {
      ok: false,
      reason: parsed.error.code === 'AMBIGUOUS_SEPARATOR' ? 'DECIMAL_AMBIGUOUS' : 'DECIMAL_INVALID',
    };
  }
  const money = parsed.value;
  if (money.isNegative()) {
    return { ok: false, reason: 'PRICE_NEGATIVE' };
  }
  if (money.scale > MAX_SCALE) {
    return { ok: false, reason: 'DECIMAL_SCALE_EXCEEDED' };
  }
  if (money.compare(MAGNITUDE_LIMIT) >= 0) {
    return { ok: false, reason: 'DECIMAL_MAGNITUDE_EXCEEDED' };
  }
  return money.equals(ZERO)
    ? { ok: true, value: money, warning: 'PRICE_ZERO' }
    : { ok: true, value: money };
}
