import { AUTH_KINDS, type AuthKind } from '@importer/contracts';
import { useState, type FormEvent } from 'react';
import { EMPTY_CREDENTIALS_FORM, type CredentialsFormValues } from '../../store-form-values';
import { es } from '../../i18n/es';
import { Button } from '../atoms/Button';
import { TextField } from '../atoms/TextField';
import { joinId } from '../ids';

interface CredentialsFormProps {
  /** Create form: asks for the name and domain too. Replace form: credentials only. */
  readonly withIdentity: boolean;
  readonly idPrefix: string;
  readonly submitLabel: string;
  readonly busyLabel: string;
  readonly busy: boolean;
  readonly onSubmit: (values: CredentialsFormValues) => void;
}

const KIND_OPTIONS: readonly AuthKind[] = AUTH_KINDS.options;

export function CredentialsForm({
  withIdentity,
  idPrefix,
  submitLabel,
  busyLabel,
  busy,
  onSubmit,
}: CredentialsFormProps) {
  const [values, setValues] = useState<CredentialsFormValues>(EMPTY_CREDENTIALS_FORM);
  const set = (patch: Partial<CredentialsFormValues>) => setValues((old) => ({ ...old, ...patch }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(values);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {withIdentity ? (
        <>
          <TextField
            id={joinId(idPrefix, 'name')}
            label={es.stores.displayName}
            value={values.displayName}
            onChange={(event) => set({ displayName: event.currentTarget.value })}
            disabled={busy}
          />
          <TextField
            id={joinId(idPrefix, 'domain')}
            label={es.stores.domainLabel}
            hint={es.stores.domainHint}
            value={values.domain}
            onChange={(event) => set({ domain: event.currentTarget.value })}
            disabled={busy}
          />
        </>
      ) : null}
      <fieldset className="flex flex-col gap-2" disabled={busy}>
        <legend className="text-sm font-medium text-gray-900">{es.stores.authKindLabel}</legend>
        <div className="flex flex-wrap gap-4">
          {KIND_OPTIONS.map((kind) => (
            <label key={kind} className="flex items-center gap-2 text-sm text-gray-900">
              <input
                type="radio"
                name={joinId(idPrefix, 'kind')}
                value={kind}
                checked={values.kind === kind}
                onChange={() => set({ kind })}
              />
              {es.stores.authKinds[kind]}
            </label>
          ))}
        </div>
      </fieldset>
      {values.kind === 'static_token' ? (
        <TextField
          id={joinId(idPrefix, 'token')}
          label={es.stores.accessToken}
          hint={es.stores.secretHint}
          type="password"
          value={values.accessToken}
          onChange={(event) => set({ accessToken: event.currentTarget.value })}
          disabled={busy}
        />
      ) : (
        <>
          <TextField
            id={joinId(idPrefix, 'client-id')}
            label={es.stores.clientId}
            value={values.clientId}
            onChange={(event) => set({ clientId: event.currentTarget.value })}
            disabled={busy}
          />
          <TextField
            id={joinId(idPrefix, 'client-secret')}
            label={es.stores.clientSecret}
            hint={es.stores.secretHint}
            type="password"
            value={values.clientSecret}
            onChange={(event) => set({ clientSecret: event.currentTarget.value })}
            disabled={busy}
          />
        </>
      )}
      <div>
        <Button type="submit" label={busy ? busyLabel : submitLabel} busy={busy} />
      </div>
    </form>
  );
}
