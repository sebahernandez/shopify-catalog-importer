import { describe, expect, it } from 'vitest';
import { IssueCollector } from '../issue-collector.js';
import type { SourceRow } from '../structure/read-rows.js';
import type { VariantRow } from '../variant-row.js';
import type { FieldValue } from '../workbook-cell.js';
import { variantesInventoryRules } from './variantes-inventory-rules.js';

const text = (value: string): FieldValue => ({ kind: 'text', text: value });
const number = (raw: string): FieldValue => ({ kind: 'number', raw });

interface Cells {
  flag?: FieldValue;
  stock?: FieldValue;
  location?: FieldValue;
}

/** An empty cell is simply absent, like readRows leaves it. */
function row({ flag, stock, location }: Cells, untrusted: string[] = []): SourceRow {
  const cells = new Map<string, FieldValue>();
  if (flag !== undefined) cells.set('gestionar_inventario', flag);
  if (stock !== undefined) cells.set('stock', stock);
  if (location !== undefined) cells.set('ubicacion', location);
  return { sourceRow: 2, cells, untrusted: new Set(untrusted) };
}

function run(source: SourceRow) {
  const sink = new IssueCollector(100);
  const variants: VariantRow[] = [{ sourceRow: 2, productKey: 'P1', sku: undefined }];
  const typed = variantesInventoryRules([source], variants, sink);
  return { typed: typed[0], issues: sink.build().issues };
}

const error = (code: string, field: string, params = {}) => ({
  severity: 'error',
  code,
  sheet: 'Variantes',
  row: 2,
  field,
  params,
});

describe('variantesInventoryRules', () => {
  it.each<[FieldValue, boolean]>([
    [text('Sí'), true],
    [text('SI'), true],
    [text('no'), false],
    [text('Verdadero'), true],
    [text('FALSO'), false],
    [number('1'), true],
    [number('0'), false],
    [{ kind: 'boolean', value: true }, true],
  ])('accepts the flag %j as %s', (flag, expected) => {
    // A managed flag needs stock and location, so give them to keep the run silent.
    const { issues, typed } = run(row({ flag, stock: number('4'), location: text('Main') }));
    expect(issues).toEqual([]);
    expect(typed?.manageInventory).toBe(expected);
  });

  it('blocks an unknown spelling', () => {
    const { issues, typed } = run(row({ flag: text('quizás'), stock: number('4') }));
    expect(issues).toEqual([error('BOOLEAN_INVALID', 'gestionar_inventario')]);
    expect(typed?.manageInventory).toBeUndefined();
  });

  it('requires the flag when there is stock', () => {
    const { issues, typed } = run(row({ stock: number('5') }));
    expect(issues).toEqual([error('INVENTORY_FLAG_REQUIRED', 'gestionar_inventario')]);
    expect(typed?.manageInventory).toBeUndefined();
    expect(typed?.stock).toBe(5);
  });

  it('reads an empty flag with empty stock as false and silent', () => {
    const { issues, typed } = run(row({}));
    expect(issues).toEqual([]);
    expect(typed?.manageInventory).toBe(false);
    expect(typed?.stock).toBeUndefined();
  });

  it('accepts stock 3 and keeps the trimmed location', () => {
    const { issues, typed } = run(
      row({ flag: text('si'), stock: number('3'), location: text(' Main ') }),
    );
    expect(issues).toEqual([]);
    expect(typed).toMatchObject({ manageInventory: true, stock: 3, location: 'Main' });
  });

  it.each([
    ['-1', number('-1')],
    ['2.5', number('2.5')],
    ['abc', text('abc')],
    ['above 32 bits', number('2147483648')],
  ])('blocks stock %s', (_name, stock) => {
    const { issues, typed } = run(row({ flag: text('no'), stock }));
    expect(issues).toEqual([error('STOCK_INVALID', 'stock')]);
    expect(typed?.stock).toBeUndefined();
  });

  it('requires stock when inventory is managed', () => {
    const issues = run(row({ flag: text('si'), location: text('Main') })).issues;
    expect(issues).toEqual([error('STOCK_INVALID', 'stock')]);
  });

  it('requires ubicacion when inventory is managed', () => {
    const { issues } = run(row({ flag: text('si'), stock: number('2') }));
    expect(issues).toEqual([error('REQUIRED_FIELD_MISSING', 'ubicacion', { field: 'ubicacion' })]);
  });

  it('does not require ubicacion when inventory is not managed', () => {
    expect(run(row({ flag: text('no'), stock: number('2') })).issues).toEqual([]);
  });

  it('skips an untrusted stock without a cascade', () => {
    // A date cell in stock is already CELL_TYPE_UNEXPECTED from readRows.
    const managed = run(row({ flag: text('si'), location: text('Main') }, ['stock']));
    expect(managed.issues).toEqual([]);
    expect(run(row({}, ['stock'])).issues).toEqual([]);
  });

  it('skips an untrusted flag and an untrusted ubicacion', () => {
    expect(run(row({ stock: number('2') }, ['gestionar_inventario'])).issues).toEqual([]);
    expect(run(row({ flag: text('si'), stock: number('2') }, ['ubicacion'])).issues).toEqual([]);
  });
});
