import type { ReactNode } from 'react';
import { es } from '../../i18n/es';

interface StepSectionProps {
  readonly number: number;
  readonly name: string;
  readonly heading: string;
  /** When set, the body is replaced by this explanation of what unlocks the step. */
  readonly lockedMessage?: string | undefined;
  readonly children: ReactNode;
}

export function StepSection({ number, name, heading, lockedMessage, children }: StepSectionProps) {
  const headingId = `heading`;
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-lg border border-gray-300 p-5"
    >
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          {es.wizard.stepLabel(number, name)}
        </p>
        <h2 id={headingId} className="text-lg font-medium text-gray-900">
          {heading}
        </h2>
      </header>
      {lockedMessage === undefined ? (
        children
      ) : (
        <p className="text-sm text-gray-600">{lockedMessage}</p>
      )}
    </section>
  );
}
