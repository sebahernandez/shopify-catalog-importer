import type {
  ImportResponse,
  StoreSummary,
  StoreVerification,
  ValidationReport,
} from '@importer/contracts';
import type { ApiFailure } from '../api/request';

/** The state of one call: nothing yet, in flight, answered, or failed. */
export type Remote<T> =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'success'; readonly data: T }
  | { readonly status: 'failure'; readonly failure: ApiFailure };

export const IDLE = { status: 'idle' } as const;
export const LOADING = { status: 'loading' } as const;

export interface PickedFile {
  readonly name: string;
  readonly size: number;
}

export interface WizardState {
  readonly stores: Remote<readonly StoreSummary[]>;
  readonly selectedStoreId: string | null;
  readonly create: Remote<StoreSummary>;
  readonly verify: Remote<StoreVerification>;
  readonly replace: Remote<StoreSummary>;
  readonly file: PickedFile | null;
  readonly validation: Remote<ValidationReport>;
  readonly template: Remote<true>;
  readonly importRun: Remote<ImportResponse>;
}

export const INITIAL_WIZARD: WizardState = {
  stores: LOADING,
  selectedStoreId: null,
  create: IDLE,
  verify: IDLE,
  replace: IDLE,
  file: null,
  validation: IDLE,
  template: IDLE,
  importRun: IDLE,
};

export type WizardAction =
  | { readonly type: 'stores/loading' }
  | { readonly type: 'stores/loaded'; readonly stores: readonly StoreSummary[] }
  | { readonly type: 'stores/failed'; readonly failure: ApiFailure }
  | { readonly type: 'store/selected'; readonly id: string | null }
  | { readonly type: 'create/started' }
  | { readonly type: 'create/succeeded'; readonly store: StoreSummary }
  | { readonly type: 'create/failed'; readonly failure: ApiFailure }
  | { readonly type: 'verify/started' }
  | { readonly type: 'verify/succeeded'; readonly verification: StoreVerification }
  | { readonly type: 'verify/failed'; readonly failure: ApiFailure }
  | { readonly type: 'replace/started' }
  | { readonly type: 'replace/succeeded'; readonly store: StoreSummary }
  | { readonly type: 'replace/failed'; readonly failure: ApiFailure }
  | { readonly type: 'template/started' }
  | { readonly type: 'template/succeeded' }
  | { readonly type: 'template/failed'; readonly failure: ApiFailure }
  | { readonly type: 'file/picked'; readonly file: PickedFile }
  | { readonly type: 'file/cleared' }
  | { readonly type: 'validation/succeeded'; readonly report: ValidationReport }
  | { readonly type: 'validation/failed'; readonly failure: ApiFailure }
  | { readonly type: 'import/started' }
  | { readonly type: 'import/succeeded'; readonly response: ImportResponse }
  | { readonly type: 'import/failed'; readonly failure: ApiFailure }
  | { readonly type: 'import/reset' };

function replaceStore(
  stores: Remote<readonly StoreSummary[]>,
  store: StoreSummary,
): Remote<readonly StoreSummary[]> {
  if (stores.status !== 'success') return stores;
  const known = stores.data.some((entry) => entry.id === store.id);
  return {
    status: 'success',
    data: known
      ? stores.data.map((entry) => (entry.id === store.id ? store : entry))
      : [...stores.data, store],
  };
}

/** What a changed store or file invalidates: the file report and any import answer. */
const CLEARED_RUN = { validation: IDLE, importRun: IDLE } as const;

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'stores/loading':
      return { ...state, stores: LOADING };
    case 'stores/loaded':
      return {
        ...state,
        stores: { status: 'success', data: action.stores },
        // A store that vanished from the list can no longer be the chosen one.
        selectedStoreId: action.stores.some((store) => store.id === state.selectedStoreId)
          ? state.selectedStoreId
          : null,
      };
    case 'stores/failed':
      return { ...state, stores: { status: 'failure', failure: action.failure } };
    case 'store/selected':
      return action.id === state.selectedStoreId
        ? state
        : {
            ...state,
            selectedStoreId: action.id,
            create: IDLE,
            verify: IDLE,
            replace: IDLE,
            importRun: IDLE,
          };
    case 'create/started':
      return { ...state, create: LOADING };
    case 'create/succeeded':
      return {
        ...state,
        stores: replaceStore(state.stores, action.store),
        selectedStoreId: action.store.id,
        create: { status: 'success', data: action.store },
        verify: IDLE,
        replace: IDLE,
        importRun: IDLE,
      };
    case 'create/failed':
      return { ...state, create: { status: 'failure', failure: action.failure } };
    case 'verify/started':
      return { ...state, verify: LOADING };
    case 'verify/succeeded':
      return { ...state, verify: { status: 'success', data: action.verification } };
    case 'verify/failed':
      return { ...state, verify: { status: 'failure', failure: action.failure } };
    case 'replace/started':
      return { ...state, replace: LOADING };
    case 'replace/succeeded':
      return {
        ...state,
        stores: replaceStore(state.stores, action.store),
        replace: { status: 'success', data: action.store },
        verify: IDLE,
        importRun: IDLE,
      };
    case 'replace/failed':
      return { ...state, replace: { status: 'failure', failure: action.failure } };
    case 'template/started':
      return { ...state, template: LOADING };
    case 'template/succeeded':
      return { ...state, template: { status: 'success', data: true } };
    case 'template/failed':
      return { ...state, template: { status: 'failure', failure: action.failure } };
    case 'file/picked':
      return { ...state, file: action.file, validation: LOADING, importRun: IDLE };
    case 'file/cleared':
      return { ...state, file: null, ...CLEARED_RUN };
    case 'validation/succeeded':
      return { ...state, validation: { status: 'success', data: action.report } };
    case 'validation/failed':
      return { ...state, validation: { status: 'failure', failure: action.failure } };
    case 'import/started':
      return { ...state, importRun: LOADING };
    case 'import/succeeded':
      return { ...state, importRun: { status: 'success', data: action.response } };
    case 'import/failed':
      return { ...state, importRun: { status: 'failure', failure: action.failure } };
    case 'import/reset':
      return { ...state, file: null, ...CLEARED_RUN };
  }
}

export function selectedStore(state: WizardState): StoreSummary | null {
  if (state.stores.status !== 'success' || state.selectedStoreId === null) return null;
  return state.stores.data.find((store) => store.id === state.selectedStoreId) ?? null;
}

/**
 * The store is usable for an import when the API says CONNECTED. A verification that just came back
 * ok is not enough on its own: the stored status is what the import endpoint checks.
 */
export function isStoreConnected(state: WizardState): boolean {
  return selectedStore(state)?.status === 'CONNECTED';
}

export type WizardStep = 'store' | 'file' | 'import';

export interface WizardView {
  readonly step: WizardStep;
  readonly fileUnlocked: boolean;
  readonly importUnlocked: boolean;
  readonly canImport: boolean;
  readonly importing: boolean;
}

export function isFileValid(state: WizardState): boolean {
  return state.validation.status === 'success' && state.validation.data.valid;
}

/** Everything the screen needs to decide what is open, locked, enabled or running. */
export function wizardView(state: WizardState): WizardView {
  const fileUnlocked = isStoreConnected(state);
  const importUnlocked = fileUnlocked && isFileValid(state);
  const importing = state.importRun.status === 'loading';
  const step: WizardStep = !fileUnlocked ? 'store' : !importUnlocked ? 'file' : 'import';
  return {
    step,
    fileUnlocked,
    importUnlocked,
    canImport: importUnlocked && !importing,
    importing,
  };
}
