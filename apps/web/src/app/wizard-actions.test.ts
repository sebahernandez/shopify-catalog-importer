import { describe, expect, it, vi } from 'vitest';
import {
  STORE_ID,
  INVALID_REPORT,
  importResponse,
  report,
  storeSummary,
  verification,
} from '../test-fixtures';
import type { ApiFailure, ApiResult } from '../api/request';
import { createWizardActions, type WizardDeps } from './wizard-actions';
import { INITIAL_WIZARD, wizardReducer, type WizardAction, type WizardState } from './wizard-state';

const ok = <T>(data: T): ApiResult<T> => ({ ok: true, data });
const fail = (failure: ApiFailure): ApiResult<never> => ({ ok: false, failure });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function setup(overrides: Partial<WizardDeps> = {}) {
  let state: WizardState = INITIAL_WIZARD;
  const seen: WizardAction[] = [];
  const dispatch = (action: WizardAction) => {
    seen.push(action);
    state = wizardReducer(state, action);
  };
  const deps: WizardDeps = {
    listStores: vi.fn(() => Promise.resolve(ok([storeSummary()]))),
    createStore: vi.fn(() => Promise.resolve(ok(storeSummary()))),
    verifyStore: vi.fn(() => Promise.resolve(ok(verification()))),
    replaceCredentials: vi.fn(() => Promise.resolve(ok(storeSummary()))),
    validateWorkbook: vi.fn(() => Promise.resolve(ok(report()))),
    downloadTemplate: vi.fn(() => Promise.resolve(ok(new Blob(['x'])))),
    importCatalog: vi.fn(() => Promise.resolve(ok(importResponse()))),
    saveBlob: vi.fn(),
    ...overrides,
  };
  const actions = createWizardActions(deps, dispatch);
  return {
    actions,
    deps,
    seen,
    get state() {
      return state;
    },
  };
}

const FILE = new File([new Uint8Array([1, 2, 3])], 'catalogo.xlsx');
const CREATE_BODY = {
  displayName: 'Mi tienda',
  domain: 'mi-tienda.myshopify.com',
  credentials: { kind: 'static_token', accessToken: 'shpat_12345678' },
} as const;

describe('wizard actions', () => {
  it('loads the stores', async () => {
    const t = setup();
    await t.actions.loadStores();
    expect(t.state.stores).toEqual({ status: 'success', data: [storeSummary()] });
  });

  it('reports a failed store list', async () => {
    const t = setup({ listStores: () => Promise.resolve(fail({ kind: 'network' })) });
    await t.actions.loadStores();
    expect(t.state.stores).toEqual({ status: 'failure', failure: { kind: 'network' } });
  });

  it('creates a store, chooses it and sends the body untouched', async () => {
    const t = setup();
    await t.actions.createStore(CREATE_BODY);
    expect(t.deps.createStore).toHaveBeenCalledWith(CREATE_BODY, expect.anything());
    expect(t.state.selectedStoreId).toBe(STORE_ID);
  });

  it('keeps a failed creation as an error and chooses nothing', async () => {
    const failure: ApiFailure = {
      kind: 'api',
      status: 409,
      code: 'STORE_ALREADY_EXISTS',
      report: null,
    };
    const t = setup({ createStore: () => Promise.resolve(fail(failure)) });
    await t.actions.createStore(CREATE_BODY);
    expect(t.state.create).toEqual({ status: 'failure', failure });
    expect(t.state.selectedStoreId).toBeNull();
  });

  it('verifies the chosen store and then reloads the list to pick up its new status', async () => {
    const listStores = vi
      .fn<WizardDeps['listStores']>()
      .mockResolvedValueOnce(ok([storeSummary()]))
      .mockResolvedValueOnce(ok([storeSummary({ status: 'CONNECTED' })]));
    const t = setup({ listStores });
    await t.actions.loadStores();
    t.actions.selectStore(STORE_ID);
    await t.actions.verify();
    expect(t.deps.verifyStore).toHaveBeenCalledWith(STORE_ID, expect.anything());
    expect(listStores).toHaveBeenCalledTimes(2);
    expect(t.state.verify.status).toBe('success');
    expect(t.state.stores).toEqual({
      status: 'success',
      data: [storeSummary({ status: 'CONNECTED' })],
    });
  });

  it('reports a verification that could not be made, and still reloads the list', async () => {
    const t = setup({ verifyStore: () => Promise.resolve(fail({ kind: 'timeout' })) });
    t.actions.selectStore(STORE_ID);
    await t.actions.verify();
    expect(t.state.verify).toEqual({ status: 'failure', failure: { kind: 'timeout' } });
    expect(t.deps.listStores).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a chosen store', async () => {
    const t = setup();
    await t.actions.verify();
    await t.actions.replaceCredentials({ kind: 'static_token', accessToken: 'shpat_12345678' });
    await t.actions.runImport();
    expect(t.deps.verifyStore).not.toHaveBeenCalled();
    expect(t.deps.replaceCredentials).not.toHaveBeenCalled();
    expect(t.seen).toEqual([]);
  });

  it('drops a verification answer that arrives after another store was chosen', async () => {
    const slow = deferred<ApiResult<ReturnType<typeof verification>>>();
    const t = setup({ verifyStore: () => slow.promise });
    t.actions.selectStore(STORE_ID);
    const pending = t.actions.verify();
    t.actions.selectStore('another');
    slow.resolve(ok(verification()));
    await pending;
    expect(t.state.verify.status).toBe('idle');
  });

  it('replaces credentials for the chosen store', async () => {
    const t = setup();
    t.actions.selectStore(STORE_ID);
    const credentials = { kind: 'static_token', accessToken: 'shpat_87654321' } as const;
    await t.actions.replaceCredentials(credentials);
    expect(t.deps.replaceCredentials).toHaveBeenCalledWith(
      STORE_ID,
      credentials,
      expect.anything(),
    );
    expect(t.state.replace.status).toBe('success');
  });

  it('downloads the template and hands it to the browser', async () => {
    const t = setup();
    await t.actions.downloadTemplate();
    expect(t.deps.saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'catalog-template.xlsx');
    expect(t.state.template.status).toBe('success');
  });

  it('reports a failed template download without saving anything', async () => {
    const t = setup({ downloadTemplate: () => Promise.resolve(fail({ kind: 'network' })) });
    await t.actions.downloadTemplate();
    expect(t.deps.saveBlob).not.toHaveBeenCalled();
    expect(t.state.template.status).toBe('failure');
  });

  it('validates a picked file and keeps its name and size', async () => {
    const t = setup();
    await t.actions.pickFile(FILE);
    expect(t.deps.validateWorkbook).toHaveBeenCalledWith(FILE, expect.anything());
    expect(t.state.file).toEqual({ name: 'catalogo.xlsx', size: 3 });
    expect(t.state.validation).toEqual({ status: 'success', data: report() });
  });

  it('ignores a validation answer for a file that was replaced meanwhile', async () => {
    const first = deferred<ApiResult<ReturnType<typeof report>>>();
    const validateWorkbook = vi
      .fn<WizardDeps['validateWorkbook']>()
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce(ok(INVALID_REPORT));
    const t = setup({ validateWorkbook });
    const one = t.actions.pickFile(FILE);
    await t.actions.pickFile(new File(['x'], 'otro.xlsx'));
    first.resolve(ok(report()));
    await one;
    expect(t.state.validation).toEqual({ status: 'success', data: INVALID_REPORT });
  });

  it('clears the file when none is chosen', async () => {
    const t = setup();
    await t.actions.pickFile(FILE);
    await t.actions.pickFile(null);
    expect(t.state.file).toBeNull();
    expect(t.state.validation.status).toBe('idle');
  });

  it('validates the same file again on request', async () => {
    const t = setup();
    await t.actions.pickFile(FILE);
    await t.actions.revalidate();
    expect(t.deps.validateWorkbook).toHaveBeenCalledTimes(2);
  });

  it('imports the same file the user picked, into the chosen store', async () => {
    const t = setup();
    t.actions.selectStore(STORE_ID);
    await t.actions.pickFile(FILE);
    await t.actions.runImport();
    expect(t.deps.importCatalog).toHaveBeenCalledWith(STORE_ID, FILE, expect.anything());
    expect(t.state.importRun).toEqual({ status: 'success', data: importResponse() });
  });

  it('does not import without a picked file', async () => {
    const t = setup();
    t.actions.selectStore(STORE_ID);
    await t.actions.runImport();
    expect(t.deps.importCatalog).not.toHaveBeenCalled();
  });

  it('ignores a second import request while one is running', async () => {
    const slow = deferred<ApiResult<ReturnType<typeof importResponse>>>();
    const t = setup({ importCatalog: vi.fn(() => slow.promise) });
    t.actions.selectStore(STORE_ID);
    await t.actions.pickFile(FILE);
    const first = t.actions.runImport();
    await t.actions.runImport();
    expect(t.deps.importCatalog).toHaveBeenCalledTimes(1);
    slow.resolve(ok(importResponse()));
    await first;
    expect(t.state.importRun.status).toBe('success');
  });

  it('shows the report of a rejected workbook where the file errors belong', async () => {
    const failure: ApiFailure = {
      kind: 'api',
      status: 422,
      code: 'WORKBOOK_INVALID',
      report: INVALID_REPORT,
    };
    const t = setup({ importCatalog: () => Promise.resolve(fail(failure)) });
    t.actions.selectStore(STORE_ID);
    await t.actions.pickFile(FILE);
    await t.actions.runImport();
    expect(t.state.validation).toEqual({ status: 'success', data: INVALID_REPORT });
    expect(t.state.importRun).toEqual({ status: 'failure', failure });
  });

  it('cancels the wait for the import and reports it as aborted', async () => {
    let signal: AbortSignal | undefined;
    const t = setup({
      importCatalog: (_id, _file, options) => {
        signal = options?.signal;
        return new Promise<ApiResult<ReturnType<typeof importResponse>>>((resolve) => {
          signal?.addEventListener('abort', () => resolve(fail({ kind: 'aborted' })));
        });
      },
    });
    t.actions.selectStore(STORE_ID);
    await t.actions.pickFile(FILE);
    const running = t.actions.runImport();
    t.actions.cancelImport();
    await running;
    expect(signal?.aborted).toBe(true);
    expect(t.state.importRun).toEqual({ status: 'failure', failure: { kind: 'aborted' } });
  });

  it('lets a cancelled import be started again', async () => {
    const importCatalog = vi
      .fn<WizardDeps['importCatalog']>()
      .mockResolvedValueOnce(fail({ kind: 'aborted' }))
      .mockResolvedValueOnce(ok(importResponse()));
    const t = setup({ importCatalog });
    t.actions.selectStore(STORE_ID);
    await t.actions.pickFile(FILE);
    await t.actions.runImport();
    await t.actions.runImport();
    expect(t.state.importRun.status).toBe('success');
  });

  it('starts over without a file or an answer', async () => {
    const t = setup();
    t.actions.selectStore(STORE_ID);
    await t.actions.pickFile(FILE);
    await t.actions.runImport();
    t.actions.startOver();
    expect(t.state.file).toBeNull();
    await t.actions.runImport();
    expect(t.deps.importCatalog).toHaveBeenCalledTimes(1);
  });

  it('aborts in-flight requests and stays quiet when the page goes away', async () => {
    let signal: AbortSignal | undefined;
    const t = setup({
      listStores: (options) => {
        signal = options?.signal;
        return new Promise<ApiResult<never[]>>((resolve) => {
          signal?.addEventListener('abort', () => resolve(fail({ kind: 'aborted' })));
        });
      },
    });
    const loading = t.actions.loadStores();
    t.actions.dispose();
    await loading;
    expect(signal?.aborted).toBe(true);
    expect(t.state.stores.status).toBe('loading');
  });
});
