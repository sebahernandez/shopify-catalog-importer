import { defineConfig } from 'prisma/config';
import { loadConfig } from './src/config/load-config.js';
import { databaseUrl } from './src/persistence/database-location.js';

// Prisma commands run as their own processes, outside the API's boot, so this file computes the
// location itself. It uses the same loader and the same path helper as the API: the migration and
// the running service cannot point at different files. The loader does not change `process.env`.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: databaseUrl(loadConfig().dataDir) },
});
