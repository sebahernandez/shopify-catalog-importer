import { describe, expect, it } from 'vitest';
import { type CollectedIssue, IssueCollector } from './issue-collector.js';

const issue = (overrides: Partial<CollectedIssue> = {}): CollectedIssue => ({
  severity: 'error',
  code: 'REQUIRED_FIELD_MISSING',
  sheet: 'Productos',
  row: 2,
  field: 'titulo',
  params: {},
  ...overrides,
});

describe('IssueCollector', () => {
  it('keeps exact counts above the cap and flags truncation', () => {
    const collector = new IssueCollector(1_000);
    for (let row = 2; row < 1_002; row += 1) {
      collector.add(issue({ row }));
    }
    for (let row = 2; row < 502; row += 1) {
      collector.add(issue({ severity: 'warning', row }));
    }
    const report = collector.build();
    expect(report).toMatchObject({ errorCount: 1_000, warningCount: 500, truncated: true });
    expect(report.issues).toHaveLength(1_000);
  });

  it('stores at most the cap per severity', () => {
    const collector = new IssueCollector(2);
    for (let row = 2; row < 7; row += 1) {
      collector.add(issue({ severity: 'warning', row }));
    }
    expect(collector.build()).toMatchObject({ warningCount: 5, truncated: true });
    expect(collector.build().issues).toHaveLength(2);
  });

  it('keeps errors before warnings when truncating', () => {
    const collector = new IssueCollector(3);
    collector.add(issue({ severity: 'warning', row: 2 }));
    collector.add(issue({ row: 3 }));
    collector.add(issue({ row: 4 }));
    collector.add(issue({ severity: 'warning', row: 5 }));
    const { issues } = collector.build();
    expect(issues.map((item) => item.severity)).toEqual(['error', 'error', 'warning']);
  });

  it('does not flag truncation when everything fits', () => {
    const collector = new IssueCollector(2);
    collector.add(issue());
    expect(collector.build()).toMatchObject({ truncated: false, errorCount: 1 });
  });

  it('sorts by file, sheet order, row, column and code', () => {
    const collector = new IssueCollector(10);
    collector.add(issue({ sheet: 'Imagenes', row: 2, field: 'archivo' }));
    collector.add(issue({ sheet: 'Variantes', row: 3, field: 'precio', code: 'B' }));
    collector.add(issue({ sheet: 'Variantes', row: 3, field: 'precio', code: 'A' }));
    collector.add(issue({ sheet: 'Variantes', row: 3, field: 'product_key' }));
    collector.add(issue({ sheet: 'Variantes', row: 2, field: 'precio' }));
    collector.add(issue({ sheet: 'Productos', row: 9, field: 'handle' }));
    collector.add(issue({ sheet: null, row: null, field: null, code: 'FILE_UNREADABLE' }));
    const order = collector.build().issues.map((i) => [i.sheet, i.row, i.field, i.code]);
    expect(order).toEqual([
      [null, null, null, 'FILE_UNREADABLE'],
      ['Productos', 9, 'handle', 'REQUIRED_FIELD_MISSING'],
      ['Variantes', 2, 'precio', 'REQUIRED_FIELD_MISSING'],
      ['Variantes', 3, 'product_key', 'REQUIRED_FIELD_MISSING'],
      ['Variantes', 3, 'precio', 'A'],
      ['Variantes', 3, 'precio', 'B'],
      ['Imagenes', 2, 'archivo', 'REQUIRED_FIELD_MISSING'],
    ]);
  });
});
