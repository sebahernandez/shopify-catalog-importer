import { describe, expect, it } from 'vitest';
import {
  OTHER_STORE_ID,
  STORE_ID,
  INVALID_REPORT,
  importResponse,
  report,
  storeSummary,
  verification,
} from '../test-fixtures';
import {
  INITIAL_WIZARD,
  isFileValid,
  selectedStore,
  wizardReducer,
  wizardView,
  type WizardAction,
  type WizardState,
} from './wizard-state';

function run(...actions: WizardAction[]): WizardState {
  return actions.reduce(wizardReducer, INITIAL_WIZARD);
}

const connected = storeSummary({ status: 'CONNECTED' });
const FAILURE = { kind: 'network' } as const;

describe('wizard state machine', () => {
  it('starts loading the store list, with nothing chosen and every later step blocked', () => {
    expect(INITIAL_WIZARD.stores.status).toBe('loading');
    expect(wizardView(INITIAL_WIZARD)).toEqual({
      step: 'store',
      fileUnlocked: false,
      importUnlocked: false,
      canImport: false,
      importing: false,
    });
  });

  it('keeps the file step locked while the chosen store is not CONNECTED', () => {
    const state = run(
      { type: 'stores/loaded', stores: [storeSummary()] },
      { type: 'store/selected', id: STORE_ID },
    );
    expect(selectedStore(state)?.id).toBe(STORE_ID);
    expect(wizardView(state).fileUnlocked).toBe(false);
  });

  it.each(['UNVERIFIED', 'AUTH_FAILED', 'SCOPE_MISSING', 'UNAVAILABLE'] as const)(
    'keeps the file step locked for a %s store',
    (status) => {
      const state = run(
        { type: 'stores/loaded', stores: [storeSummary({ status })] },
        { type: 'store/selected', id: STORE_ID },
      );
      expect(wizardView(state).step).toBe('store');
    },
  );

  it('opens the file step for a CONNECTED store, and import only for a valid file', () => {
    let state = run(
      { type: 'stores/loaded', stores: [connected] },
      { type: 'store/selected', id: STORE_ID },
    );
    expect(wizardView(state)).toMatchObject({
      step: 'file',
      fileUnlocked: true,
      importUnlocked: false,
    });

    state = wizardReducer(state, { type: 'file/picked', file: { name: 'a.xlsx', size: 3 } });
    expect(state.validation.status).toBe('loading');
    expect(wizardView(state).canImport).toBe(false);

    state = wizardReducer(state, { type: 'validation/succeeded', report: report() });
    expect(isFileValid(state)).toBe(true);
    expect(wizardView(state)).toMatchObject({ step: 'import', canImport: true });
  });

  it('blocks the import when the report has errors', () => {
    const state = run(
      { type: 'stores/loaded', stores: [connected] },
      { type: 'store/selected', id: STORE_ID },
      { type: 'file/picked', file: { name: 'a.xlsx', size: 3 } },
      { type: 'validation/succeeded', report: INVALID_REPORT },
    );
    expect(isFileValid(state)).toBe(false);
    expect(wizardView(state)).toMatchObject({
      step: 'file',
      importUnlocked: false,
      canImport: false,
    });
  });

  it('blocks the import when validation itself failed', () => {
    const state = run(
      { type: 'stores/loaded', stores: [connected] },
      { type: 'store/selected', id: STORE_ID },
      { type: 'file/picked', file: { name: 'a.xlsx', size: 3 } },
      { type: 'validation/failed', failure: FAILURE },
    );
    expect(wizardView(state).canImport).toBe(false);
  });

  it('disables a second import while one is running', () => {
    const state = run(
      { type: 'stores/loaded', stores: [connected] },
      { type: 'store/selected', id: STORE_ID },
      { type: 'file/picked', file: { name: 'a.xlsx', size: 3 } },
      { type: 'validation/succeeded', report: report() },
      { type: 'import/started' },
    );
    expect(wizardView(state)).toMatchObject({ importing: true, canImport: false });
  });

  it('stores the import answer, and a failure leaves the file valid so it can be retried', () => {
    const base = run(
      { type: 'stores/loaded', stores: [connected] },
      { type: 'store/selected', id: STORE_ID },
      { type: 'file/picked', file: { name: 'a.xlsx', size: 3 } },
      { type: 'validation/succeeded', report: report() },
      { type: 'import/started' },
    );
    const done = wizardReducer(base, { type: 'import/succeeded', response: importResponse() });
    expect(done.importRun).toEqual({ status: 'success', data: importResponse() });
    const failed = wizardReducer(base, { type: 'import/failed', failure: FAILURE });
    expect(failed.importRun.status).toBe('failure');
    expect(wizardView(failed).canImport).toBe(true);
  });

  it('clears the verification and the import answer when another store is chosen', () => {
    const state = run(
      { type: 'stores/loaded', stores: [connected, storeSummary({ id: OTHER_STORE_ID })] },
      { type: 'store/selected', id: STORE_ID },
      { type: 'verify/succeeded', verification: verification() },
      { type: 'import/succeeded', response: importResponse() },
      { type: 'store/selected', id: OTHER_STORE_ID },
    );
    expect(state.verify.status).toBe('idle');
    expect(state.importRun.status).toBe('idle');
    expect(state.selectedStoreId).toBe(OTHER_STORE_ID);
  });

  it('keeps everything when the same store is chosen again', () => {
    const before = run(
      { type: 'stores/loaded', stores: [connected] },
      { type: 'store/selected', id: STORE_ID },
      { type: 'verify/succeeded', verification: verification() },
    );
    expect(wizardReducer(before, { type: 'store/selected', id: STORE_ID })).toBe(before);
  });

  it('selects a store as soon as it is created and adds it to the list', () => {
    const state = run(
      { type: 'stores/loaded', stores: [] },
      { type: 'create/started' },
      { type: 'create/succeeded', store: storeSummary() },
    );
    expect(state.selectedStoreId).toBe(STORE_ID);
    expect(state.stores).toEqual({ status: 'success', data: [storeSummary()] });
    expect(state.create.status).toBe('success');
  });

  it('keeps the form state of a failed creation and chooses nothing', () => {
    const state = run({ type: 'create/started' }, { type: 'create/failed', failure: FAILURE });
    expect(state.create).toEqual({ status: 'failure', failure: FAILURE });
    expect(state.selectedStoreId).toBeNull();
  });

  it('forgets a chosen store that disappears from a reloaded list', () => {
    const state = run(
      { type: 'stores/loaded', stores: [connected] },
      { type: 'store/selected', id: STORE_ID },
      { type: 'stores/loaded', stores: [] },
    );
    expect(state.selectedStoreId).toBeNull();
    expect(wizardView(state).step).toBe('store');
  });

  it('updates the stored status after a refresh, which is what unlocks the file step', () => {
    const state = run(
      { type: 'stores/loaded', stores: [storeSummary()] },
      { type: 'store/selected', id: STORE_ID },
      { type: 'verify/succeeded', verification: verification() },
    );
    expect(wizardView(state).fileUnlocked).toBe(false);
    const refreshed = wizardReducer(state, { type: 'stores/loaded', stores: [connected] });
    expect(wizardView(refreshed).fileUnlocked).toBe(true);
  });

  it('drops the verification and the import answer when credentials are replaced', () => {
    const state = run(
      { type: 'stores/loaded', stores: [connected] },
      { type: 'store/selected', id: STORE_ID },
      { type: 'verify/succeeded', verification: verification() },
      { type: 'replace/succeeded', store: storeSummary({ status: 'UNVERIFIED' }) },
    );
    expect(state.verify.status).toBe('idle');
    expect(wizardView(state).fileUnlocked).toBe(false);
  });

  it('picking a new file discards the old report and import answer', () => {
    const state = run(
      { type: 'stores/loaded', stores: [connected] },
      { type: 'store/selected', id: STORE_ID },
      { type: 'file/picked', file: { name: 'a.xlsx', size: 3 } },
      { type: 'validation/succeeded', report: report() },
      { type: 'import/succeeded', response: importResponse() },
      { type: 'file/picked', file: { name: 'b.xlsx', size: 9 } },
    );
    expect(state.importRun.status).toBe('idle');
    expect(state.validation.status).toBe('loading');
    expect(state.file).toEqual({ name: 'b.xlsx', size: 9 });
  });

  it('starting over clears the file, the report and the answer but keeps the store', () => {
    const state = run(
      { type: 'stores/loaded', stores: [connected] },
      { type: 'store/selected', id: STORE_ID },
      { type: 'file/picked', file: { name: 'a.xlsx', size: 3 } },
      { type: 'validation/succeeded', report: report() },
      { type: 'import/succeeded', response: importResponse() },
      { type: 'import/reset' },
    );
    expect(state).toMatchObject({ file: null, selectedStoreId: STORE_ID });
    expect(state.validation.status).toBe('idle');
    expect(state.importRun.status).toBe('idle');
  });
});
