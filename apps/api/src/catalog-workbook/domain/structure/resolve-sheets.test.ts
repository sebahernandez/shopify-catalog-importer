import { describe, expect, it } from 'vitest';
import { buildSheet } from '../../test-support/sheet-builder.js';
import { IssueCollector } from '../issue-collector.js';
import { resolveSheets } from './resolve-sheets.js';

const named = (...names: string[]) => names.map((name, index) => buildSheet(name, [], { index }));

function run(...names: string[]) {
  const sink = new IssueCollector(1_000);
  const resolved = resolveSheets(named(...names), sink);
  return { resolved, issues: sink.build().issues };
}

describe('resolveSheets', () => {
  it('resolves an accented, padded name to the canonical sheet', () => {
    const { resolved, issues } = run('Productos', 'Variantes', ' Imágenes ');
    expect(resolved.get('Imagenes')?.name).toBe(' Imágenes ');
    expect(issues).toEqual([]);
  });

  it('reports colliding names once and chooses neither', () => {
    const { resolved, issues } = run('Productos', 'Variantes', 'Imagenes', 'imágenes');
    expect(resolved.has('Imagenes')).toBe(false);
    expect(issues).toEqual([
      {
        severity: 'error',
        code: 'SHEET_DUPLICATE',
        sheet: 'Imagenes',
        row: null,
        field: null,
        params: { sheet: 'Imagenes' },
      },
    ]);
  });

  it('reports a missing sheet once, with no other issue', () => {
    const { resolved, issues } = run('Productos', 'Imagenes');
    expect(resolved.has('Variantes')).toBe(false);
    expect(issues.map((issue) => [issue.code, issue.params])).toEqual([
      ['SHEET_MISSING', { sheet: 'Variantes' }],
    ]);
  });

  it('ignores Instrucciones and unknown sheets', () => {
    const { resolved, issues } = run(
      'Productos',
      'Variantes',
      'Imagenes',
      'Instrucciones',
      'Notas',
    );
    expect([...resolved.keys()].sort()).toEqual(['Imagenes', 'Productos', 'Variantes']);
    expect(issues).toEqual([]);
  });
});
