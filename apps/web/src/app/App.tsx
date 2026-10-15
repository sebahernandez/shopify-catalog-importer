import { es } from '../i18n/es';
import { HealthStatusContainer } from './HealthStatusContainer';
import { WizardContainer } from './WizardContainer';

export function App() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">{es.product}</h1>
        <p className="text-sm text-gray-700">{es.wizard.intro}</p>
      </header>
      <WizardContainer />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium text-gray-900">{es.health.heading}</h2>
        <HealthStatusContainer />
      </section>
    </main>
  );
}
