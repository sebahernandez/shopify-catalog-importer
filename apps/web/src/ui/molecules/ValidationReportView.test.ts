import { describe, expect, it } from 'vitest';
import { es } from '../../i18n/es';
import { INVALID_REPORT, report } from '../../test-fixtures';
import { render, textOf } from '../ui-render';
import { ValidationReportView } from './ValidationReportView';

describe('ValidationReportView', () => {
  it('says a clean report is valid', () => {
    const text = textOf(render(ValidationReportView, { report: report() }));
    expect(text).toContain(es.file.valid);
    expect(text).toContain('0 errores');
    expect(text).not.toContain(es.file.issuesHeading);
  });

  it('flags warnings on a valid file without blocking', () => {
    const html = render(ValidationReportView, {
      report: report({
        summary: { errorCount: 0, warningCount: 1 },
        issues: [
          {
            severity: 'warning',
            code: 'PRICE_ZERO',
            params: {},
            sheet: 'Variantes',
            row: 3,
            field: 'precio',
            productKey: null,
            message: 'm',
            suggestedAction: 's',
          },
        ],
      }),
    });
    expect(textOf(html)).toContain(es.file.validWithWarnings);
    expect(textOf(html)).toContain(es.file.severity.warning);
  });

  it('lists each error with its sheet, row, field and the catalog message', () => {
    const text = textOf(render(ValidationReportView, { report: INVALID_REPORT }));
    expect(text).toContain(es.file.invalid);
    expect(text).toContain('Hoja Productos, fila 4, columna titulo');
    expect(text).toContain('Falta un valor obligatorio en la columna titulo.');
    expect(text).toContain('Completa la columna titulo en esta fila.');
    expect(text).toContain(es.file.severity.error);
  });

  it('warns when the list is cut short', () => {
    const text = textOf(
      render(ValidationReportView, { report: { ...INVALID_REPORT, truncated: true } }),
    );
    expect(text).toContain(es.file.truncated);
  });
});
