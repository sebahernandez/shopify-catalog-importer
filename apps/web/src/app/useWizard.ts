import { useEffect, useMemo, useReducer, useRef } from 'react';
import {
  REAL_DEPS,
  createWizardActions,
  type WizardActions,
  type WizardDeps,
} from './wizard-actions';
import {
  INITIAL_WIZARD,
  wizardReducer,
  wizardView,
  type WizardState,
  type WizardView,
} from './wizard-state';

export interface UseWizard {
  readonly state: WizardState;
  readonly view: WizardView;
  readonly actions: WizardActions;
}

/**
 * Owns the wizard state. The actions object is made inside the effect and torn down with it, so
 * the development double-mount of React gets a fresh, un-aborted one the second time; the stable
 * `actions` handed out only forwards to whichever is current.
 */
export function useWizard(deps: WizardDeps = REAL_DEPS): UseWizard {
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_WIZARD);
  const current = useRef<WizardActions | null>(null);

  useEffect(() => {
    const actions = createWizardActions(deps, dispatch);
    current.current = actions;
    void actions.loadStores();
    return () => {
      actions.dispose();
      current.current = null;
    };
  }, [deps]);

  const actions = useMemo<WizardActions>(
    () => ({
      loadStores: async () => current.current?.loadStores(),
      selectStore: (id) => current.current?.selectStore(id),
      createStore: async (body) => current.current?.createStore(body),
      verify: async () => current.current?.verify(),
      replaceCredentials: async (credentials) => current.current?.replaceCredentials(credentials),
      downloadTemplate: async () => current.current?.downloadTemplate(),
      pickFile: async (file) => current.current?.pickFile(file),
      revalidate: async () => current.current?.revalidate(),
      runImport: async () => current.current?.runImport(),
      cancelImport: () => current.current?.cancelImport(),
      startOver: () => current.current?.startOver(),
      dispose: () => current.current?.dispose(),
    }),
    [],
  );

  return { state, view: wizardView(state), actions };
}
