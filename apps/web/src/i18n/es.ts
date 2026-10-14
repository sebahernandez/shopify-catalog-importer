import type { HealthState } from '../health-state';

// Every user-visible string of the web package lives here, in neutral Spanish. Components import
// this catalog and never carry copy of their own. The product name is not translated.
export const es = {
  product: 'Shopify Catalog Importer',
  health: {
    heading: 'Estado de la API',
    states: {
      loading: 'Comprobando el estado de la API…',
      ok: 'La API y la base de datos están operativas',
      degraded: 'La API responde, pero la base de datos no está disponible',
      unreachable: 'No se pudo conectar con la API',
    } satisfies Record<HealthState, string>,
    version: (version: string): string => `Versión de la API de Shopify: ${version}`,
  },
};
