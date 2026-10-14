import { describe, expect, it } from 'vitest';
import { buildSheet, type CellSpec } from '../../test-support/sheet-builder.js';
import { IssueCollector } from '../issue-collector.js';
import { resolveHeaders } from './resolve-headers.js';

function run(sheet: 'Productos' | 'Variantes', header: readonly CellSpec[]) {
  const sink = new IssueCollector(1_000);
  const result = resolveHeaders(sheet, buildSheet(sheet, [header]), sink);
  return { ...result, issues: sink.build().issues };
}

describe('resolveHeaders', () => {
  it('maps case, accents, padding and any order to canonical columns', () => {
    const { columns, usable, issues } = run('Productos', ['TITULO', 'Handle', ' product_key ']);
    expect(Object.fromEntries(columns)).toEqual({ titulo: 1, handle: 2, product_key: 3 });
    expect(usable).toBe(true);
    expect(issues).toEqual([]);
  });

  it('reports a missing required column by its canonical name', () => {
    const { usable, issues } = run('Productos', ['product_key', 'titulo']);
    expect(usable).toBe(false);
    expect(issues).toEqual([
      {
        severity: 'error',
        code: 'HEADER_MISSING',
        sheet: 'Productos',
        row: 1,
        field: 'handle',
        params: { sheet: 'Productos', column: 'handle' },
      },
    ]);
  });

  it('reports a duplicate header once and maps neither column', () => {
    const { columns, usable, issues } = run('Variantes', ['product_key', 'precio', 'SKU', 'sku']);
    expect(columns.has('sku')).toBe(false);
    expect(usable).toBe(true);
    expect(issues.map((issue) => [issue.code, issue.field])).toEqual([['HEADER_DUPLICATE', 'sku']]);
  });

  it('stays silent about an absent optional column', () => {
    const { issues } = run('Productos', ['product_key', 'handle', 'titulo']);
    expect(issues).toEqual([]);
  });

  it('warns about an unknown header with the text written in the file', () => {
    const { columns, usable, issues } = run('Variantes', ['product_key', 'precio', 'notas']);
    expect(columns.has('notas')).toBe(false);
    expect(usable).toBe(true);
    expect(issues).toEqual([
      {
        severity: 'warning',
        code: 'HEADER_UNKNOWN',
        sheet: 'Variantes',
        row: 1,
        field: null,
        params: { sheet: 'Variantes', header: 'notas' },
      },
    ]);
  });

  it('ignores empty header cells', () => {
    const { issues } = run('Productos', ['product_key', null, 'handle', ' ', 'titulo']);
    expect(issues).toEqual([]);
  });
});
