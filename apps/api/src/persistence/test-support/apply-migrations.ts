import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs the real Prisma CLI (`migrate deploy`, the command behind `pnpm db:migrate`) against the
// database in `<sandbox>/data`. The data directory and the whole environment are passed
// explicitly and HOME points into the sandbox, so nothing here can reach the default data
// directory or the real home directory.
const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
const prismaDir = join(apiRoot, 'prisma');

export interface MigrationRun {
  status: number | null;
  output: string;
}

/** Names of the committed migration folders, oldest first. */
export function committedMigrations(): string[] {
  return readdirSync(join(prismaDir, 'migrations'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Applies the committed migrations to `<sandbox>/data`; `baselineOnly` stops after the first. */
export function applyMigrations(
  sandbox: string,
  options: { baselineOnly?: boolean } = {},
): MigrationRun {
  const args = [prismaCli, 'migrate', 'deploy'];
  if (options.baselineOnly) {
    // Prisma reads the migrations next to the schema, so a copy holding the baseline alone
    // makes the run stop there.
    const partial = join(sandbox, 'baseline-only');
    const [baseline] = committedMigrations();
    mkdirSync(join(partial, 'migrations'), { recursive: true });
    cpSync(join(prismaDir, 'schema.prisma'), join(partial, 'schema.prisma'));
    cpSync(
      join(prismaDir, 'migrations', 'migration_lock.toml'),
      join(partial, 'migrations', 'migration_lock.toml'),
    );
    cpSync(
      join(prismaDir, 'migrations', baseline ?? ''),
      join(partial, 'migrations', baseline ?? ''),
      { recursive: true },
    );
    args.push('--schema', join(partial, 'schema.prisma'));
  }
  const run = spawnSync(process.execPath, args, {
    cwd: apiRoot,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      PATH: dirname(process.execPath),
      HOME: join(sandbox, 'home'),
      DATA_DIR: join(sandbox, 'data'),
      CHECKPOINT_DISABLE: '1',
      PRISMA_HIDE_UPDATE_MESSAGE: '1',
    },
  });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}
