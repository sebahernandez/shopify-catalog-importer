import type { CreateStoreBody, CredentialsPayload } from '@importer/contracts';
import { createStore, listStores, replaceCredentials, verifyStore } from '../api/stores-client';
import { downloadTemplate, importCatalog, validateWorkbook } from '../api/workbook-client';
import { TEMPLATE_FILENAME, saveBlob } from './save-file';
import type { WizardAction } from './wizard-state';

export interface WizardDeps {
  readonly listStores: typeof listStores;
  readonly createStore: typeof createStore;
  readonly verifyStore: typeof verifyStore;
  readonly replaceCredentials: typeof replaceCredentials;
  readonly validateWorkbook: typeof validateWorkbook;
  readonly downloadTemplate: typeof downloadTemplate;
  readonly importCatalog: typeof importCatalog;
  readonly saveBlob: (blob: Blob, filename: string) => void;
}

export const REAL_DEPS: WizardDeps = {
  listStores,
  createStore,
  verifyStore,
  replaceCredentials,
  validateWorkbook,
  downloadTemplate,
  importCatalog,
  saveBlob,
};

export interface WizardActions {
  readonly loadStores: () => Promise<void>;
  readonly selectStore: (id: string | null) => void;
  readonly createStore: (body: CreateStoreBody) => Promise<void>;
  readonly verify: () => Promise<void>;
  readonly replaceCredentials: (credentials: CredentialsPayload) => Promise<void>;
  readonly downloadTemplate: () => Promise<void>;
  readonly pickFile: (file: File | null) => Promise<void>;
  readonly revalidate: () => Promise<void>;
  readonly runImport: () => Promise<void>;
  readonly cancelImport: () => void;
  readonly startOver: () => void;
  /** Aborts everything in flight (the page is going away). */
  readonly dispose: () => void;
}

/**
 * The wizard's behaviour, apart from React: each action calls the API and reports through
 * `dispatch`. Answers that arrive after the store or the file changed are dropped, so a slow
 * request can never overwrite a newer choice. The picked file itself is held here, not in state.
 */
export function createWizardActions(
  deps: WizardDeps,
  dispatch: (action: WizardAction) => void,
): WizardActions {
  const lifetime = new AbortController();
  let storeId: string | null = null;
  let file: File | null = null;
  let fileToken = 0;
  let storeToken = 0;
  let importController: AbortController | null = null;

  const signal = lifetime.signal;

  async function refreshStores(): Promise<void> {
    const result = await deps.listStores({ signal });
    if (result.ok) dispatch({ type: 'stores/loaded', stores: result.data });
  }

  async function validateCurrent(): Promise<void> {
    if (file === null) return;
    const token = ++fileToken;
    dispatch({ type: 'file/picked', file: { name: file.name, size: file.size } });
    const result = await deps.validateWorkbook(file, { signal });
    if (token !== fileToken) return;
    dispatch(
      result.ok
        ? { type: 'validation/succeeded', report: result.data }
        : { type: 'validation/failed', failure: result.failure },
    );
  }

  return {
    async loadStores() {
      dispatch({ type: 'stores/loading' });
      const result = await deps.listStores({ signal });
      if (signal.aborted) return;
      dispatch(
        result.ok
          ? { type: 'stores/loaded', stores: result.data }
          : { type: 'stores/failed', failure: result.failure },
      );
    },

    selectStore(id) {
      if (id === storeId) return;
      storeId = id;
      storeToken += 1;
      dispatch({ type: 'store/selected', id });
    },

    async createStore(body) {
      dispatch({ type: 'create/started' });
      const result = await deps.createStore(body, { signal });
      if (signal.aborted) return;
      if (!result.ok) {
        dispatch({ type: 'create/failed', failure: result.failure });
        return;
      }
      storeId = result.data.id;
      storeToken += 1;
      dispatch({ type: 'create/succeeded', store: result.data });
    },

    async verify() {
      const id = storeId;
      if (id === null) return;
      const token = storeToken;
      dispatch({ type: 'verify/started' });
      const result = await deps.verifyStore(id, { signal });
      if (token !== storeToken || signal.aborted) return;
      dispatch(
        result.ok
          ? { type: 'verify/succeeded', verification: result.data }
          : { type: 'verify/failed', failure: result.failure },
      );
      // Verifying records the new status on the store, so read the list again.
      await refreshStores();
    },

    async replaceCredentials(credentials) {
      const id = storeId;
      if (id === null) return;
      const token = storeToken;
      dispatch({ type: 'replace/started' });
      const result = await deps.replaceCredentials(id, credentials, { signal });
      if (token !== storeToken || signal.aborted) return;
      dispatch(
        result.ok
          ? { type: 'replace/succeeded', store: result.data }
          : { type: 'replace/failed', failure: result.failure },
      );
    },

    async downloadTemplate() {
      dispatch({ type: 'template/started' });
      const result = await deps.downloadTemplate({ signal });
      if (signal.aborted) return;
      if (!result.ok) {
        dispatch({ type: 'template/failed', failure: result.failure });
        return;
      }
      deps.saveBlob(result.data, TEMPLATE_FILENAME);
      dispatch({ type: 'template/succeeded' });
    },

    async pickFile(picked) {
      if (picked === null) {
        file = null;
        fileToken += 1;
        dispatch({ type: 'file/cleared' });
        return;
      }
      file = picked;
      await validateCurrent();
    },

    revalidate: validateCurrent,

    async runImport() {
      const id = storeId;
      const body = file;
      if (id === null || body === null || importController !== null) return;
      const controller = new AbortController();
      importController = controller;
      const onLifetimeAbort = () => controller.abort();
      signal.addEventListener('abort', onLifetimeAbort, { once: true });
      dispatch({ type: 'import/started' });
      try {
        const result = await deps.importCatalog(id, body, { signal: controller.signal });
        if (lifetime.signal.aborted) return;
        if (result.ok) {
          dispatch({ type: 'import/succeeded', response: result.data });
          return;
        }
        const { failure } = result;
        // The server found errors the earlier validation did not: show them where they belong.
        if (failure.kind === 'api' && failure.report !== null) {
          dispatch({ type: 'validation/succeeded', report: failure.report });
        }
        dispatch({ type: 'import/failed', failure });
      } finally {
        signal.removeEventListener('abort', onLifetimeAbort);
        importController = null;
      }
    },

    cancelImport() {
      importController?.abort();
    },

    startOver() {
      file = null;
      fileToken += 1;
      dispatch({ type: 'import/reset' });
    },

    dispose() {
      lifetime.abort();
    },
  };
}
