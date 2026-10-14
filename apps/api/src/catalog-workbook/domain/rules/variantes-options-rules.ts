import type { IssueCollector } from '../issue-collector.js';
import { matchKey } from '../match-key.js';
import type { SourceRow } from '../structure/read-rows.js';
import type { VariantRow } from '../variant-row.js';
import type { FieldValue } from '../workbook-cell.js';

const SHEET = 'Variantes';
const POSITIONS = [1, 2, 3] as const;
const MAX_VARIANTS = 250;
const MAX_VALUE_CHARS = 255;

/** One option cell as trimmed text; an empty cell is absent from the row. */
function optionText(cell: FieldValue | undefined): string | undefined {
  const value = cell?.kind === 'text' ? cell.text : cell?.kind === 'number' ? cell.raw : undefined;
  const trimmed = value?.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** A row of a product whose options can be judged: every pair is trusted and complete. */
interface Judged {
  readonly row: number;
  /** Names, then values, per position; empty string when the pair is not used. */
  readonly names: readonly string[];
  readonly values: readonly string[];
}

/**
 * Checks the options of Variantes rows grouped by product: complete pairs, same names in the same
 * positions, no repeated combination, and the soft count and length limits. A row without a
 * product_key is left to the cross-sheet rule, and a row with an untrusted option cell is skipped.
 * Returns the identity rows extended with their option fields.
 */
export function variantesOptionsRules(
  rows: readonly SourceRow[],
  variants: readonly VariantRow[],
  sink: IssueCollector,
): VariantRow[] {
  const groups = new Map<string, Judged[]>();
  /** Variants per product and the row of the first one over the soft limit. */
  const counts = new Map<string, { total: number; overflowRow: number }>();

  const typed = rows.map((source, index) => {
    const variant = variants[index] as VariantRow;
    const { productKey } = variant;
    if (productKey === undefined || productKey === '') return variant;
    const seen = counts.get(productKey) ?? { total: 0, overflowRow: 0 };
    seen.total += 1;
    if (seen.total === MAX_VARIANTS + 1) seen.overflowRow = source.sourceRow;
    counts.set(productKey, seen);
    const fields = POSITIONS.flatMap((n) => [`opcion${n}_nombre`, `opcion${n}_valor`]);
    if (fields.some((field) => source.untrusted.has(field))) return variant;

    const report = (
      severity: 'error' | 'warning',
      code: string,
      field: string,
      params: Record<string, string | number> = {},
    ) => sink.add({ severity, code, sheet: SHEET, row: source.sourceRow, field, params });

    const result: Record<string, string | undefined> = {};
    const names: string[] = [];
    const values: string[] = [];
    let complete = true;
    for (const n of POSITIONS) {
      const name = optionText(source.cells.get(`opcion${n}_nombre`));
      const value = optionText(source.cells.get(`opcion${n}_valor`));
      if ((name === undefined) !== (value === undefined)) {
        report(
          'error',
          'OPTION_INCOMPLETE',
          `opcion${n}_${name === undefined ? 'nombre' : 'valor'}`,
        );
        complete = false;
      } else if (value !== undefined && value.length > MAX_VALUE_CHARS) {
        report('warning', 'OPTION_VALUE_TOO_LONG', `opcion${n}_valor`);
      }
      names.push(name === undefined || value === undefined ? '' : name);
      values.push(name === undefined || value === undefined ? '' : value);
      if (name !== undefined && value !== undefined) {
        result[`opcion${n}_nombre`] = name;
        result[`opcion${n}_valor`] = value;
      }
    }
    if (complete)
      groups.set(productKey, [
        ...(groups.get(productKey) ?? []),
        { row: source.sourceRow, names, values },
      ]);
    return { ...variant, ...result };
  });

  for (const group of groups.values()) checkGroup(group, sink);
  for (const { total, overflowRow } of counts.values()) {
    if (total <= MAX_VARIANTS) continue;
    sink.add({
      severity: 'warning',
      code: 'VARIANT_COUNT_HIGH',
      sheet: SHEET,
      row: overflowRow,
      field: null,
      params: { count: total },
    });
  }
  return typed;
}

/** Consistency of names against the first judged row, then repeated value combinations. */
function checkGroup(group: readonly Judged[], sink: IssueCollector): void {
  const [first] = group;
  if (first === undefined || group.length < 2) return;
  const signature = (judged: Judged) => judged.names.map(matchKey).join('\u0000');
  const unnamed = first.names.every((name) => name === '');
  const flag = (row: number) =>
    sink.add({
      severity: 'error',
      code: 'OPTIONS_INCONSISTENT',
      sheet: SHEET,
      row,
      field: 'opcion1_nombre',
      params: {},
    });

  if (unnamed) return flag((group[1] as Judged).row);
  const firstUse = new Map<string, number>();
  for (const judged of group) {
    if (signature(judged) !== signature(first)) {
      flag(judged.row);
      continue;
    }
    const combination = judged.values.map(matchKey).join('\u0000');
    const earlier = firstUse.get(combination);
    if (earlier === undefined) {
      firstUse.set(combination, judged.row);
    } else {
      sink.add({
        severity: 'error',
        code: 'OPTION_COMBINATION_DUPLICATE',
        sheet: SHEET,
        row: judged.row,
        field: 'opcion1_valor',
        params: { firstRow: earlier },
      });
    }
  }
}
