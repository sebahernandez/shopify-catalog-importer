import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface Manifest {
  engines?: { node?: string };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));

function readManifest(relativePath: string): Manifest {
  return JSON.parse(
    readFileSync(new URL(relativePath, `file://${workspaceRoot}`), 'utf8'),
  ) as Manifest;
}

function allDependencyNames(manifest: Manifest): string[] {
  return [
    manifest.dependencies,
    manifest.devDependencies,
    manifest.peerDependencies,
    manifest.optionalDependencies,
  ].flatMap((group) => Object.keys(group ?? {}));
}

describe('workspace invariants', () => {
  it('declares the Node floor in the root manifest', () => {
    expect(readManifest('package.json').engines?.node).toBe('>=24');
  });

  // Vacuous until the web package exists (S0 unit U15), by design.
  const webManifestPath = `${workspaceRoot}apps/web/package.json`;

  it.skipIf(!existsSync(webManifestPath))('keeps the web package isolated from the API', () => {
    const names = allDependencyNames(readManifest('apps/web/package.json'));
    expect(names).not.toContain('@importer/api');
  });

  it.skipIf(!existsSync(webManifestPath))(
    'depends on contracts only among workspace packages',
    () => {
      const names = allDependencyNames(readManifest('apps/web/package.json'));
      expect(names.filter((name) => name.startsWith('@importer/'))).toEqual([
        '@importer/contracts',
      ]);
    },
  );
});
