import { describe, expect, it } from 'vitest';
import { IssueCollector } from '../issue-collector.js';
import type { SourceRow } from '../structure/read-rows.js';
import type { VariantRow } from '../variant-row.js';
import type { FieldValue } from '../workbook-cell.js';
import { imagenesRules } from './imagenes-rules.js';

const text = (value: string): FieldValue => ({ kind: 'text', text: value });
const number = (raw: string): FieldValue => ({ kind: 'number', raw });

/** A field left out takes a valid default; `null` leaves the cell empty, like readRows does. */
interface Cells {
  key?: FieldValue | null;
  file?: FieldValue | null;
  order?: FieldValue | null;
  alt?: FieldValue | null;
  sku?: FieldValue | null;
}

function row(sourceRow: number, given: Cells = {}, untrusted: string[] = []): SourceRow {
  const defaults = { key: text('P1'), file: text('a.jpg'), order: number('1') };
  const merged = { ...defaults, ...given };
  const fields: [string, FieldValue | null | undefined][] = [
    ['product_key', merged.key],
    ['archivo', merged.file],
    ['orden', merged.order],
    ['alt', merged.alt],
    ['variant_sku', merged.sku],
  ];
  const cells = new Map<string, FieldValue>();
  for (const [field, value] of fields) if (value) cells.set(field, value);
  return { sourceRow, cells, untrusted: new Set(untrusted) };
}

const variant = (sourceRow: number, sku: string, productKey = 'P1'): VariantRow => ({
  sourceRow,
  productKey,
  sku,
});

function run(
  rows: SourceRow[],
  variants: VariantRow[] | null = [],
  untrustedSkuProducts: ReadonlySet<string> = new Set(),
) {
  const sink = new IssueCollector(1000);
  const typed = imagenesRules(rows, variants ?? undefined, sink, untrustedSkuProducts);
  return { typed, issues: sink.build().issues };
}

const issue = (code: string, rowNumber: number, field: string | null, params = {}) => ({
  severity: code === 'ALT_TOO_LONG' || code === 'IMAGE_COUNT_HIGH' ? 'warning' : 'error',
  code,
  sheet: 'Imagenes',
  row: rowNumber,
  field,
  params,
});

describe('imagenesRules', () => {
  it.each<[string, FieldValue | null]>([
    ['empty', null],
    ['zero', number('0')],
    ['negative', number('-1')],
    ['fractional', number('1.5')],
    ['text', text('abc')],
  ])('blocks an %s orden', (_name, order) => {
    const { issues, typed } = run([row(2, { order })]);
    expect(issues).toEqual([issue('IMAGE_ORDER_INVALID', 2, 'orden')]);
    expect(typed[0]?.order).toBeUndefined();
  });

  it('accepts orden 2 and allows gaps', () => {
    const rows = [row(2, { order: number('2') }), row(3, { order: number('9') })];
    const { issues, typed } = run(rows);
    expect(issues).toEqual([]);
    expect(typed.map((image) => image.order)).toEqual([2, 9]);
  });

  it('flags the second image with a repeated orden of the same product', () => {
    const { issues } = run([row(2), row(3, { file: text('b.jpg') }), row(4, { key: text('P2') })]);
    expect(issues).toEqual([issue('IMAGE_ORDER_DUPLICATE', 3, 'orden', { firstRow: 2 })]);
  });

  it('keeps the normalized path and reports the reason of a bad one', () => {
    const { issues, typed } = run([
      row(2, { file: text(' fotos\\a b.jpg ') }),
      row(3, { file: text('/etc/passwd'), order: number('2') }),
    ]);
    expect(typed[0]?.path).toBe('fotos/a b.jpg');
    expect(typed[1]?.path).toBeUndefined();
    expect(issues).toEqual([
      issue('IMAGE_PATH_INVALID', 3, 'archivo', { reason: 'IMAGE_PATH_ABSOLUTE' }),
    ]);
  });

  it('accepts an https URL as written and marks its kind', () => {
    const { issues, typed } = run([
      row(2, { file: text('https://cdn.x.test/a.jpg') }),
      row(3, { file: text('fotos/a.jpg'), order: number('2') }),
    ]);
    expect(issues).toEqual([]);
    expect(typed.map(({ path, kind }) => [path, kind])).toEqual([
      ['https://cdn.x.test/a.jpg', 'url'],
      ['fotos/a.jpg', 'local'],
    ]);
  });

  it('rejects a file: URL with the scheme reason', () => {
    const { issues } = run([row(2, { file: text('file:///etc/passwd') })]);
    expect(issues).toEqual([
      issue('IMAGE_PATH_INVALID', 2, 'archivo', { reason: 'IMAGE_PATH_URL_SCHEME' }),
    ]);
  });

  it('reports an empty archivo with the empty reason', () => {
    const { issues } = run([row(2, { file: null })]);
    expect(issues).toEqual([
      issue('IMAGE_PATH_INVALID', 2, 'archivo', { reason: 'IMAGE_PATH_EMPTY' }),
    ]);
  });

  it('warns on alt over 512 characters and accepts exactly 512', () => {
    const long = row(2, { alt: text('x'.repeat(513)) });
    const edge = row(3, { alt: text('x'.repeat(512)), order: number('2') });
    expect(run([long, edge]).issues).toEqual([issue('ALT_TOO_LONG', 2, 'alt')]);
  });

  it('warns once when a product has more than 250 images', () => {
    const rows = Array.from({ length: 251 }, (_, i) =>
      row(i + 2, { order: number(String(i + 1)) }),
    );
    expect(run(rows).issues).toEqual([issue('IMAGE_COUNT_HIGH', 252, null, { count: 251 })]);
    expect(run(rows.slice(0, 250)).issues).toEqual([]);
  });

  it('matches variant_sku on trimmed text against one variant of the same product', () => {
    const variants = [variant(2, 'A-1'), variant(3, 'A-1', 'P2')];
    const { issues, typed } = run([row(2, { sku: text(' A-1 ') })], variants);
    expect(issues).toEqual([]);
    expect(typed[0]?.variantSku).toBe('A-1');
  });

  it('blocks an unknown variant_sku', () => {
    const { issues, typed } = run([row(2, { sku: text('B-2') })], [variant(2, 'A-1')]);
    expect(issues).toEqual([issue('VARIANT_SKU_UNKNOWN', 2, 'variant_sku')]);
    expect(typed[0]?.variantSku).toBeUndefined();
  });

  it('blocks a variant_sku that matches two variants', () => {
    const variants = [variant(2, 'A-1'), variant(3, 'A-1')];
    expect(run([row(2, { sku: text('A-1') })], variants).issues).toEqual([
      issue('VARIANT_SKU_AMBIGUOUS', 2, 'variant_sku'),
    ]);
  });

  it('does not resolve variant_sku when the variants are unavailable', () => {
    const { issues, typed } = run([row(2, { sku: text('A-1') })], null);
    expect(issues).toEqual([]);
    expect(typed[0]?.variantSku).toBeUndefined();
  });

  it('does not call a sku unknown when its product has an untrusted variant sku', () => {
    const rows = [row(2, { sku: text('B-2') }), row(3, { key: text('P2'), sku: text('B-2') })];
    const { issues } = run(rows, [variant(2, 'A-1')], new Set(['P1']));
    expect(issues).toEqual([issue('VARIANT_SKU_UNKNOWN', 3, 'variant_sku')]);
  });

  it('leaves a row without product_key to the cross-sheet rule', () => {
    const { issues, typed } = run([row(2, { key: null, sku: text('A-1') })], [variant(2, 'A-1')]);
    expect(issues).toEqual([]);
    expect(typed[0]?.productKey).toBeUndefined();
  });

  it('skips untrusted fields without a cascade', () => {
    const rows = [
      row(2, { file: null, order: null, sku: text('Z') }, ['archivo', 'orden', 'variant_sku']),
    ];
    const { issues, typed } = run(rows, [variant(2, 'A-1')]);
    expect(issues).toEqual([]);
    expect(typed[0]).toMatchObject({ path: undefined, order: undefined, variantSku: undefined });
  });
});
