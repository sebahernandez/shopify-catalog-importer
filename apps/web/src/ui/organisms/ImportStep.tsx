import type { ImportResponse } from '@importer/contracts';
import { es } from '../../i18n/es';
import { Button } from '../atoms/Button';
import { Notice } from '../atoms/Notice';
import { ImportResultView } from '../molecules/ImportResultView';
import { StepSection } from '../molecules/StepSection';

export interface ImportStepProps {
  readonly lockedMessage: string | undefined;
  readonly storeName: string;
  readonly canImport: boolean;
  readonly running: boolean;
  readonly onImport: () => void;
  readonly onCancel: () => void;
  readonly errorMessage: string | null;
  readonly response: ImportResponse | null;
  readonly onStartOver: () => void;
}

export function ImportStep(props: ImportStepProps) {
  return (
    <StepSection
      number={3}
      name={es.wizard.steps.import}
      heading={es.import.heading}
      lockedMessage={props.lockedMessage}
    >
      {props.response !== null ? (
        <>
          <ImportResultView response={props.response} />
          <div>
            <Button
              variant="secondary"
              label={es.import.importAnother}
              onClick={props.onStartOver}
            />
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-700">{es.import.ready(props.storeName)}</p>
          <Notice tone="info">
            <p>{es.import.draftNote}</p>
            <p>{es.import.repeatWarning}</p>
          </Notice>
          {props.running ? (
            <Notice tone="warning">
              <p className="font-medium">{es.import.running}</p>
              <p>{es.import.runningDetail}</p>
              <p>{es.import.cancelWarning}</p>
            </Notice>
          ) : null}
          {props.errorMessage === null ? null : (
            <Notice tone="danger">
              <p>{props.errorMessage}</p>
            </Notice>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              label={props.running ? es.import.running : es.import.start}
              busy={props.running}
              disabled={!props.canImport}
              onClick={props.onImport}
            />
            {props.running ? (
              <Button variant="secondary" label={es.import.cancel} onClick={props.onCancel} />
            ) : null}
          </div>
        </>
      )}
    </StepSection>
  );
}
