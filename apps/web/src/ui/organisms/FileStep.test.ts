import { describe, expect, it } from 'vitest';
import { es } from '../../i18n/es';
import { INVALID_REPORT, report } from '../../test-fixtures';
import { render, textOf } from '../ui-render';
import { FileStep, type FileStepProps } from './FileStep';

const noop = () => undefined;
const base: FileStepProps = {
  lockedMessage: undefined,
  templateBusy: false,
  templateError: null,
  onDownloadTemplate: noop,
  file: null,
  validating: false,
  report: null,
  validationError: null,
  onFile: noop,
  onRevalidate: noop,
};

describe('FileStep', () => {
  it('is replaced by its explanation while locked', () => {
    const html = render(FileStep, { ...base, lockedMessage: es.wizard.locked.file });
    expect(html).toContain(es.wizard.locked.file);
    expect(html).not.toContain('type="file"');
  });

  it('offers the template download and an xlsx-only file input with a label', () => {
    const html = render(FileStep, base);
    expect(html).toContain(es.file.template);
    expect(html).toMatch(/<label for="catalog-file"[^>]*>/);
    expect(html).toContain('type="file"');
    expect(html).toContain('.xlsx');
  });

  it('shows the file name and size, and a status while validating', () => {
    const html = render(FileStep, {
      ...base,
      file: { name: 'catalogo.xlsx', size: 2048 },
      validating: true,
    });
    expect(html).toContain(es.file.chosen('catalogo.xlsx', 2));
    expect(html).toContain(es.file.validating);
    expect(html).toContain('disabled=""');
  });

  it('shows a valid report', () => {
    expect(textOf(render(FileStep, { ...base, report: report() }))).toContain(es.file.valid);
  });

  it('shows an invalid report with its issues', () => {
    const text = textOf(render(FileStep, { ...base, report: INVALID_REPORT }));
    expect(text).toContain(es.file.invalid);
    expect(text).toContain(es.file.issuesHeading);
  });

  it('shows a validation failure with a way to retry, and a template failure', () => {
    const html = render(FileStep, {
      ...base,
      validationError: es.errors.network,
      templateError: es.errors.timeout,
    });
    expect(html).toContain(es.errors.network);
    expect(html).toContain(es.file.revalidate);
    expect(html).toContain(es.file.templateFailed);
    expect(html).toContain(es.errors.timeout);
  });
});
