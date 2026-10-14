import 'reflect-metadata';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ConfigModule } from '../config/config.module.js';
import { parseEnv } from '../config/env.schema.js';
import { HealthController } from '../health/health.controller.js';
import { LocalSecurityModule } from './local-security.module.js';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const API_ROOT = join(SRC, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((file) => !file.includes(`${join('src', 'generated')}`));
}

describe('the test-only write route does not ship', () => {
  const production = sourceFiles(SRC).filter((file) => !file.endsWith('.test.ts'));

  it('looks at real production sources', () => {
    expect(production.length).toBeGreaterThan(20);
    expect(production.some((file) => file.endsWith('local-request.guard.ts'))).toBe(true);
  });

  it('keeps every test file out of the build', () => {
    const build = JSON.parse(readFileSync(join(API_ROOT, 'tsconfig.build.json'), 'utf8')) as {
      exclude: string[];
    };
    expect(build.exclude).toContain('src/**/*.test.ts');
  });

  it('keeps every test-support folder out of the build', () => {
    const build = JSON.parse(readFileSync(join(API_ROOT, 'tsconfig.build.json'), 'utf8')) as {
      exclude: string[];
    };
    expect(build.exclude).toContain('src/**/test-support/**');
  });

  it('keeps the test controller and its route out of every production source', () => {
    const offenders = production
      .filter((file) => /guarded-test|TestController/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it('declares no controller in the security module or in AppModule', async () => {
    const dynamic = LocalSecurityModule.forRoot(ConfigModule.forRoot({ env: {} }));
    expect(dynamic.controllers ?? []).toEqual([]);
    expect(Reflect.getMetadata('controllers', LocalSecurityModule) ?? []).toEqual([]);
    const { AppModule } = await import('../app.module.js');
    expect(Reflect.getMetadata('controllers', AppModule) ?? []).toEqual([]);
  });

  // The health route (U14) is the one controller the application ships; it must stay the only one.
  it('declares exactly one controller, the health route, in the graph AppModule.forRoot builds', async () => {
    const { AppModule } = await import('../app.module.js');
    const dynamic = AppModule.forRoot({ config: parseEnv({}), logger: { warn: () => undefined } });
    expect(dynamic.controllers ?? []).toEqual([]);
    const imports = (dynamic.imports ?? []) as { controllers?: unknown[] }[];
    expect(imports).toHaveLength(4);
    expect(imports.flatMap((imported) => imported.controllers ?? [])).toEqual([HealthController]);
  });

  it('starts the program with no options, so no extra module and no environment switch', () => {
    const main = readFileSync(join(SRC, 'main.ts'), 'utf8');
    expect(main).toMatch(/await bootstrap\(\);/);
    for (const file of ['main.ts', 'app.module.ts']) {
      expect(readFileSync(join(SRC, file), 'utf8')).not.toMatch(/process\.env|import\.meta\.env/);
    }
  });

  it('lets no environment variable enable a route: production code reads none for the guard', () => {
    const guardFiles = production.filter((file) =>
      file.includes(`${join('src', 'local-security')}`),
    );
    expect(guardFiles.length).toBeGreaterThanOrEqual(6);
    for (const file of guardFiles) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/process\.env|import\.meta\.env/);
    }
  });
});
