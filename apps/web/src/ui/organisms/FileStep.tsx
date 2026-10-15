import type { ValidationReport } from '@importer/contracts';
import type { ChangeEvent } from 'react';
import { es } from '../../i18n/es';
import { Button } from '../atoms/Button';
import { Notice } from '../atoms/Notice';
import { StepSection } from '../molecules/StepSection';
import { ValidationReportView } from '../molecules/ValidationReportView';

export interface FileStepProps {
  /** Spanish explanation of what unlocks the step; undefined when it is open. */
  readonly lockedMessage: string | undefined;
  readonly templateBusy: boolean;
  readonly templateError: string | null;
  readonly onDownloadTemplate: () => void;
  readonly file: { readonly name: string; readonly size: number } | null;
  readonly validating: boolean;
  readonly report: ValidationReport | null;
  readonly validationError: string | null;
  readonly onFile: (file: File | null) => void;
  readonly onRevalidate: () => void;
}

const FILE_ACCEPT = '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const FILE_INPUT_ID = 'catalog-file';

export function FileStep(props: FileStepProps) {
  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    props.onFile(event.currentTarget.files?.[0] ?? null);
  };
  return (
    <StepSection
      number={2}
      name={es.wizard.steps.file}
      heading={es.file.heading}
      lockedMessage={props.lockedMessage}
    >
      <p className="text-sm text-gray-700">{es.file.intro}</p>
      <div className="flex flex-col gap-2">
        <div>
          <Button
            variant="secondary"
            label={props.templateBusy ? es.file.templating : es.file.template}
            busy={props.templateBusy}
            onClick={props.onDownloadTemplate}
          />
        </div>
        {props.templateError === null ? null : (
          <Notice tone="danger">
            <p>{es.file.templateFailed}</p>
            <p>{props.templateError}</p>
          </Notice>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={FILE_INPUT_ID} className="text-sm font-medium text-gray-900">
          {es.file.choose}
        </label>
        <input
          id={FILE_INPUT_ID}
          type="file"
          accept={FILE_ACCEPT}
          disabled={props.validating}
          onChange={pick}
          className="text-sm"
        />
        {props.file === null ? null : (
          <p className="text-xs text-gray-600">
            {es.file.chosen(props.file.name, Math.max(1, Math.round(props.file.size / 1024)))}
          </p>
        )}
      </div>
      {props.validating ? (
        <p role="status" className="text-sm text-gray-700">
          {es.file.validating}
        </p>
      ) : null}
      {props.validationError === null ? null : (
        <Notice tone="danger">
          <p>{props.validationError}</p>
          <div>
            <Button variant="secondary" label={es.file.revalidate} onClick={props.onRevalidate} />
          </div>
        </Notice>
      )}
      {props.report === null ? null : <ValidationReportView report={props.report} />}
    </StepSection>
  );
}
