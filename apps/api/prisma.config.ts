import { defineConfig } from 'prisma/config';
import { loadConfig } from './src/config/load-config.js';
import { databaseUrl, prepareDatabaseFile } from './src/persistence/database-location.js';

// Prisma commands run as their own processes, outside the API's boot, so this file computes the
// location itself. It uses the same loader and the same path helper as the API: the migration and
// the running service cannot point at different files. The loader does not change `process.env`.
const { dataDir } = loadConfig();

// Prisma would create a missing data directory with mode 0755 and the file with 0644. For the
// migrate commands the directory and file are created first, owner-only, exactly as the API does.
// `generate` and `validate` do not touch the data directory.
if (process.argv.includes('migrate')) prepareDatabaseFile(dataDir);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: { url: databaseUrl(dataDir) },
});
