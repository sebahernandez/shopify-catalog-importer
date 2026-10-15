import { FileStep } from '../ui/organisms/FileStep';
import { ImportStep } from '../ui/organisms/ImportStep';
import { StoreStep } from '../ui/organisms/StoreStep';
import { useWizard } from './useWizard';
import { fileStepProps, importStepProps, storeStepProps } from './wizard-props';

// Container: owns the wizard state (through the hook) and hands plain props to the steps.
export function WizardContainer() {
  const { state, view, actions } = useWizard();
  return (
    <div className="flex flex-col gap-6">
      <StoreStep {...storeStepProps(state, actions)} />
      <FileStep {...fileStepProps(state, view, actions)} />
      <ImportStep {...importStepProps(state, view, actions)} />
    </div>
  );
}
