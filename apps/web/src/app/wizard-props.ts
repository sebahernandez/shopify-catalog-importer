import type { StoreStepProps } from '../ui/organisms/StoreStep';
import type { FileStepProps } from '../ui/organisms/FileStep';
import type { ImportStepProps } from '../ui/organisms/ImportStep';
import { es } from '../i18n/es';
import { failureMessage } from './failure-message';
import { toCreateStoreBody, toCredentials } from './store-form';
import type { WizardActions } from './wizard-actions';
import {
  selectedStore,
  isStoreConnected,
  type Remote,
  type WizardState,
  type WizardView,
} from './wizard-state';

const errorOf = <T>(remote: Remote<T>, context: 'default' | 'import' = 'default'): string | null =>
  remote.status === 'failure' ? failureMessage(remote.failure, context) : null;

const dataOf = <T>(remote: Remote<T>): T | null =>
  remote.status === 'success' ? remote.data : null;

/** Everything below is a pure mapping from wizard state to the props of the presentational steps. */

export function storeStepProps(state: WizardState, actions: WizardActions): StoreStepProps {
  const store = selectedStore(state);
  const list = dataOf(state.stores) ?? [];
  return {
    loading: state.stores.status === 'loading',
    listError: errorOf(state.stores),
    stores: list.map((entry) => ({
      id: entry.id,
      displayName: entry.displayName,
      shopDomain: entry.shopDomain,
      status: entry.status,
      selected: entry.id === state.selectedStoreId,
    })),
    onSelect: (id) => actions.selectStore(id),
    onReload: () => void actions.loadStores(),
    creating: state.create.status === 'loading',
    createError: errorOf(state.create),
    createdNotice: state.create.status === 'success',
    onCreate: (values) => void actions.createStore(toCreateStoreBody(values)),
    selected:
      store === null
        ? null
        : { displayName: store.displayName, connected: isStoreConnected(state) },
    verifying: state.verify.status === 'loading',
    verification: dataOf(state.verify),
    verifyError: errorOf(state.verify),
    onVerify: () => void actions.verify(),
    replacing: state.replace.status === 'loading',
    replaceError: errorOf(state.replace),
    replacedNotice: state.replace.status === 'success',
    onReplace: (values) => void actions.replaceCredentials(toCredentials(values)),
  };
}

export function fileStepProps(
  state: WizardState,
  view: WizardView,
  actions: WizardActions,
): FileStepProps {
  return {
    lockedMessage: view.fileUnlocked ? undefined : es.wizard.locked.file,
    templateBusy: state.template.status === 'loading',
    templateError: errorOf(state.template),
    onDownloadTemplate: () => void actions.downloadTemplate(),
    file: state.file,
    validating: state.validation.status === 'loading',
    report: dataOf(state.validation),
    validationError: errorOf(state.validation),
    onFile: (file) => void actions.pickFile(file),
    onRevalidate: () => void actions.revalidate(),
  };
}

export function importStepProps(
  state: WizardState,
  view: WizardView,
  actions: WizardActions,
): ImportStepProps {
  return {
    lockedMessage: view.importUnlocked ? undefined : es.wizard.locked.import,
    storeName: selectedStore(state)?.displayName ?? '',
    canImport: view.canImport,
    running: view.importing,
    onImport: () => void actions.runImport(),
    onCancel: () => actions.cancelImport(),
    errorMessage: errorOf(state.importRun, 'import'),
    response: dataOf(state.importRun),
    onStartOver: () => actions.startOver(),
  };
}
