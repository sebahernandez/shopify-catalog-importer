import { describe, expect, it, vi } from 'vitest';
import { es } from '../i18n/es';
import { STORE_ID, report, storeSummary } from '../test-fixtures';
import type { WizardActions } from './wizard-actions';
import { fileStepProps, importStepProps, storeStepProps } from './wizard-props';
import {
  INITIAL_WIZARD,
  wizardReducer,
  wizardView,
  type WizardAction,
  type WizardState,
} from './wizard-state';

function actionsSpy(): WizardActions {
  return {
    loadStores: vi.fn(() => Promise.resolve()),
    selectStore: vi.fn(),
    createStore: vi.fn(() => Promise.resolve()),
    verify: vi.fn(() => Promise.resolve()),
    replaceCredentials: vi.fn(() => Promise.resolve()),
    downloadTemplate: vi.fn(() => Promise.resolve()),
    pickFile: vi.fn(() => Promise.resolve()),
    revalidate: vi.fn(() => Promise.resolve()),
    runImport: vi.fn(() => Promise.resolve()),
    cancelImport: vi.fn(),
    startOver: vi.fn(),
    dispose: vi.fn(),
  };
}

const run = (...actions: WizardAction[]): WizardState =>
  actions.reduce(wizardReducer, INITIAL_WIZARD);

const READY = run(
  { type: 'stores/loaded', stores: [storeSummary({ status: 'CONNECTED' })] },
  { type: 'store/selected', id: STORE_ID },
  { type: 'file/picked', file: { name: 'a.xlsx', size: 1 } },
  { type: 'validation/succeeded', report: report() },
);

describe('wizard props', () => {
  it('locks the file and import steps with their explanations until they are reachable', () => {
    const view = wizardView(INITIAL_WIZARD);
    expect(fileStepProps(INITIAL_WIZARD, view, actionsSpy()).lockedMessage).toBe(
      es.wizard.locked.file,
    );
    expect(importStepProps(INITIAL_WIZARD, view, actionsSpy()).lockedMessage).toBe(
      es.wizard.locked.import,
    );
  });

  it('opens both steps for a connected store and a valid file', () => {
    const view = wizardView(READY);
    expect(fileStepProps(READY, view, actionsSpy()).lockedMessage).toBeUndefined();
    const props = importStepProps(READY, view, actionsSpy());
    expect(props.lockedMessage).toBeUndefined();
    expect(props.canImport).toBe(true);
    expect(props.storeName).toBe('Mi tienda');
  });

  it('turns a store list failure and an import failure into Spanish text', () => {
    const failed = run(
      { type: 'stores/failed', failure: { kind: 'network' } },
      { type: 'import/failed', failure: { kind: 'timeout' } },
    );
    expect(storeStepProps(failed, actionsSpy()).listError).toBe(es.errors.network);
    expect(importStepProps(failed, wizardView(failed), actionsSpy()).errorMessage).toBe(
      es.errors.importUnknown,
    );
  });

  it('routes the form and button events to the matching action', () => {
    const actions = actionsSpy();
    const props = storeStepProps(READY, actions);
    props.onCreate({
      displayName: 'Mi tienda',
      domain: 'Mi-Tienda.myshopify.com',
      kind: 'static_token',
      accessToken: 'shpat_12345678',
      clientId: '',
      clientSecret: '',
    });
    expect(actions.createStore).toHaveBeenCalledWith({
      displayName: 'Mi tienda',
      domain: 'mi-tienda.myshopify.com',
      credentials: { kind: 'static_token', accessToken: 'shpat_12345678' },
    });
    props.onVerify();
    props.onSelect(STORE_ID);
    expect(actions.verify).toHaveBeenCalled();
    expect(actions.selectStore).toHaveBeenCalledWith(STORE_ID);
    const view = wizardView(READY);
    importStepProps(READY, view, actions).onImport();
    importStepProps(READY, view, actions).onCancel();
    expect(actions.runImport).toHaveBeenCalled();
    expect(actions.cancelImport).toHaveBeenCalled();
  });

  it('marks the connected store as chosen and connected', () => {
    const props = storeStepProps(READY, actionsSpy());
    expect(props.selected).toEqual({ displayName: 'Mi tienda', connected: true });
    expect(props.stores[0]?.selected).toBe(true);
  });
});
