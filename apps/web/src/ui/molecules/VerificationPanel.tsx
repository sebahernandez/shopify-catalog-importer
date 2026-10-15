import type { StoreVerification } from '@importer/contracts';
import { es } from '../../i18n/es';
import { Button } from '../atoms/Button';
import { Notice } from '../atoms/Notice';
import { joinId } from '../ids';

interface VerificationPanelProps {
  readonly connected: boolean;
  readonly running: boolean;
  readonly verification: StoreVerification | null;
  /** Spanish text for a verification call that failed outright (no answer, API error). */
  readonly failureMessage: string | null;
  readonly onVerify: () => void;
}

export function VerificationPanel({
  connected,
  running,
  verification,
  failureMessage,
  onVerify,
}: VerificationPanelProps) {
  const problems = verification?.ok === false ? verification.problems : [];
  const missing = verification?.scopes.missing ?? [];
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-base font-medium text-gray-900">{es.verification.heading}</h3>
      <Notice tone={connected ? 'success' : 'warning'}>
        <p>{connected ? es.verification.connected : es.verification.notConnected}</p>
      </Notice>
      <div>
        <Button
          variant={connected ? 'secondary' : 'primary'}
          label={
            running
              ? es.verification.verifying
              : connected
                ? es.verification.verifyAgain
                : es.verification.verify
          }
          busy={running}
          onClick={onVerify}
        />
      </div>
      {failureMessage === null ? null : (
        <Notice tone="danger">
          <p>{failureMessage}</p>
        </Notice>
      )}
      {problems.length === 0 ? null : (
        <Notice tone="danger">
          <p className="font-medium">{es.verification.outcomeFailed}</p>
          <ul className="list-disc pl-5">
            {problems.map((problem, index) => (
              <li key={joinId(problem.code, index)}>{es.verification.problems[problem.code]}</li>
            ))}
          </ul>
          {missing.length === 0 ? null : (
            <>
              <p className="mt-1 font-medium">{es.verification.missingScopes}</p>
              <ul className="list-disc pl-5 font-mono text-xs">
                {missing.map((scope) => (
                  <li key={scope}>{scope}</li>
                ))}
              </ul>
              <p>{es.verification.missingScopesHint}</p>
            </>
          )}
        </Notice>
      )}
    </div>
  );
}
