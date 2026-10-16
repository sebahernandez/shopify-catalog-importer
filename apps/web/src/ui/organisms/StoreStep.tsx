import { es } from '../../i18n/es';
import type { CredentialsFormValues } from '../../store-form-values';
import { Button } from '../atoms/Button';
import { Notice } from '../atoms/Notice';
import { StepSection } from '../molecules/StepSection';
import { StoreList, type StoreListItem } from '../molecules/StoreList';
import { VerificationPanel } from '../molecules/VerificationPanel';
import type { StoreVerification } from '@importer/contracts';
import { CredentialsForm } from './CredentialsForm';

export interface StoreStepProps {
  readonly loading: boolean;
  /** Spanish text when the list could not be loaded. */
  readonly listError: string | null;
  readonly stores: readonly StoreListItem[];
  readonly onSelect: (id: string) => void;
  readonly onReload: () => void;

  readonly creating: boolean;
  readonly createError: string | null;
  readonly createdNotice: boolean;
  readonly onCreate: (values: CredentialsFormValues) => void;

  /** Null while no store is chosen. */
  readonly selected: {
    readonly displayName: string;
    readonly connected: boolean;
  } | null;
  readonly verifying: boolean;
  readonly verification: StoreVerification | null;
  readonly verifyError: string | null;
  readonly onVerify: () => void;

  readonly replacing: boolean;
  readonly replaceError: string | null;
  readonly replacedNotice: boolean;
  readonly onReplace: (values: CredentialsFormValues) => void;
}

export function StoreStep(props: StoreStepProps) {
  const { selected } = props;
  return (
    <StepSection number={1} name={es.wizard.steps.store} heading={es.stores.heading}>
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-medium text-gray-900">{es.stores.listHeading}</h3>
        {props.loading ? (
          <p role="status" className="text-sm text-gray-600">
            {es.stores.loading}
          </p>
        ) : null}
        {props.listError === null ? null : (
          <Notice tone="danger">
            <p>{es.stores.listFailed}</p>
            <p>{props.listError}</p>
            <div>
              <Button variant="secondary" label={es.common.retry} onClick={props.onReload} />
            </div>
          </Notice>
        )}
        {!props.loading && props.listError === null && props.stores.length === 0 ? (
          <p className="text-sm text-gray-600">{es.stores.empty}</p>
        ) : null}
        {props.stores.length === 0 ? null : (
          <StoreList stores={props.stores} onSelect={props.onSelect} />
        )}
      </div>

      {selected === null ? null : (
        <div className="flex flex-col gap-3 border-t border-gray-200 pt-4">
          <p className="text-sm font-medium text-gray-900">
            {es.stores.selectedName(selected.displayName)}
          </p>
          {props.createdNotice ? (
            <Notice tone="success">
              <p>{es.stores.created}</p>
            </Notice>
          ) : null}
          <VerificationPanel
            connected={selected.connected}
            running={props.verifying}
            verification={props.verification}
            failureMessage={props.verifyError}
            onVerify={props.onVerify}
          />
          <details className="rounded-md border border-gray-300 p-3">
            <summary className="cursor-pointer text-sm font-medium text-gray-900">
              {es.stores.replaceHeading}
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <CredentialsForm
                key={props.replacedNotice ? 'replaced' : 'editing'}
                withIdentity={false}
                idPrefix="replace"
                submitLabel={es.stores.replace}
                busyLabel={es.stores.replacing}
                busy={props.replacing}
                onSubmit={props.onReplace}
              />
              {props.replacedNotice ? (
                <Notice tone="success">
                  <p>{es.stores.replaced}</p>
                </Notice>
              ) : null}
              {props.replaceError === null ? null : (
                <Notice tone="danger">
                  <p>{props.replaceError}</p>
                </Notice>
              )}
            </div>
          </details>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-gray-200 pt-4">
        <h3 className="text-base font-medium text-gray-900">{es.stores.createHeading}</h3>
        <CredentialsForm
          key={props.createdNotice ? 'created' : 'editing'}
          withIdentity
          idPrefix="create"
          submitLabel={es.stores.create}
          busyLabel={es.stores.creating}
          busy={props.creating}
          onSubmit={props.onCreate}
        />
        {props.createError === null ? null : (
          <Notice tone="danger">
            <p>{props.createError}</p>
          </Notice>
        )}
      </div>
    </StepSection>
  );
}
