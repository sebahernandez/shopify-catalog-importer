import { es } from '../i18n/es';
import { HealthStatusContainer } from './HealthStatusContainer';

export function App() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">{es.product}</h1>
      <section className="mt-6 flex flex-col gap-3">
        <h2 className="text-lg font-medium text-gray-900">{es.health.heading}</h2>
        <HealthStatusContainer />
      </section>
    </main>
  );
}
