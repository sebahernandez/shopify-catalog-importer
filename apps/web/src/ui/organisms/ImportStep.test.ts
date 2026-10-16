import { describe, expect, it } from 'vitest';
import { es } from '../../i18n/es';
import { importResponse } from '../../test-fixtures';
import { render, textOf } from '../ui-render';
import { ImportStep, type ImportStepProps } from './ImportStep';

const noop = () => undefined;
const base: ImportStepProps = {
  lockedMessage: undefined,
  storeName: 'Mi tienda',
  canImport: true,
  running: false,
  onImport: noop,
  onCancel: noop,
  errorMessage: null,
  response: null,
  onStartOver: noop,
};

describe('ImportStep', () => {
  it('is replaced by its explanation while locked', () => {
    const html = render(ImportStep, { ...base, lockedMessage: es.wizard.locked.import });
    expect(html).toContain(es.wizard.locked.import);
    expect(html).not.toContain('<button');
  });

  it('names the store, and warns about drafts and repeated runs before importing', () => {
    const text = textOf(render(ImportStep, base));
    expect(text).toContain(es.import.ready('Mi tienda'));
    expect(text).toContain(es.import.draftNote);
    expect(text).toContain(es.import.repeatWarning);
    expect(text).toContain(es.import.start);
  });

  it('disables the import button when the import is not allowed', () => {
    expect(render(ImportStep, { ...base, canImport: false })).toContain('disabled=""');
  });

  it('shows the running state, with a cancel option and no way to start twice', () => {
    const html = render(ImportStep, { ...base, running: true, canImport: false });
    expect(html).toContain(es.import.running);
    expect(html).toContain(es.import.runningDetail);
    expect(html).toContain(es.import.cancel);
    expect(html).toContain(es.import.cancelWarning);
    expect(html).toContain('aria-busy="true"');
  });

  it('shows an import error as an alert and keeps the button available to retry', () => {
    const html = render(ImportStep, { ...base, errorMessage: es.errors.importUnknown });
    expect(html).toContain(es.errors.importUnknown);
    expect(html).toContain('role="alert"');
    expect(textOf(html)).toContain(es.import.start);
  });

  it('shows the result and a way to import another file', () => {
    const text = textOf(render(ImportStep, { ...base, response: importResponse() }));
    expect(text).toContain(es.import.resultHeading);
    expect(text).toContain(es.import.importAnother);
    expect(text).not.toContain(es.import.ready('Mi tienda'));
  });
});
