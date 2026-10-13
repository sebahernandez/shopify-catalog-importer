import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { parseEnv } from './env.schema.js';
import { loadConfig, schemaVariableNames } from './load-config.js';
import { findWorkspaceRoot } from './paths.js';

const root = findWorkspaceRoot();
const samplePath = join(root, 'env.example');
const lines = readFileSync(samplePath, 'utf8').split('\n');

/** `NAME=value` lines that are not comments: what copying the sample verbatim would activate. */
const active = lines.filter((line) => /^[A-Z_]+=/.test(line));
/** Lines of the form `# NAME=value`: optional settings shown with their default. */
const commented = lines.filter((line) => /^# [A-Z_]+=/.test(line));

function toEnv(assignments: readonly string[]): Record<string, string> {
  return Object.fromEntries(
    assignments.map((line) => {
      const [name = '', ...value] = line.replace(/^# /, '').split('=');
      return [name, value.join('=')];
    }),
  );
}

describe('env.example', () => {
  it('lists every variable the schema reads, active or commented', () => {
    const listed = new Set(Object.keys(toEnv([...active, ...commented])));
    expect(schemaVariableNames().length).toBe(12);
    expect([...schemaVariableNames()].filter((name) => !listed.has(name))).toEqual([]);
    expect([...listed].filter((name) => !schemaVariableNames().includes(name))).toEqual([]);
  });

  it('lists each variable once', () => {
    const names = [...active, ...commented].map((line) => line.replace(/^# /, '').split('=')[0]);
    expect(new Set(names).size).toBe(names.length);
  });

  it('is valid as it stands: the active lines parse and equal the built-in defaults', () => {
    expect(active.length).toBeGreaterThan(0);
    expect(parseEnv(toEnv(active))).toEqual(parseEnv({}));
  });

  it('shows every optional line with a value that is also valid', () => {
    expect(commented.length).toBeGreaterThan(0);
    expect(parseEnv(toEnv([...active, ...commented]))).toMatchObject({
      allowedOrigins: ['http://127.0.0.1:5173', 'http://localhost:5173'],
    });
  });

  it('never ships an empty value, which the schema rejects', () => {
    for (const line of [...active, ...commented]) expect(line).toMatch(/^(# )?[A-Z_]+=\S/);
  });

  it('works unchanged as an env file, without a warning', () => {
    const warn = vi.fn();
    const home = join(root, 'not-used-home');
    const fromSample = loadConfig({
      env: {},
      envFile: samplePath,
      workspaceRoot: root,
      home,
      warn,
    });
    expect(fromSample).toEqual(
      loadConfig({ env: {}, envFile: join(root, 'absent.env'), workspaceRoot: root, home }),
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('holds no secret and no machine-specific path or account', () => {
    const text = lines.join('\n');
    expect(text).not.toMatch(/\/(Users|home)\//);
    expect(text).not.toMatch(/[A-Za-z]:\\/);
    expect(text).not.toMatch(/shpat_|shpss_|Bearer |BEGIN [A-Z ]*KEY/i);
    for (const line of [...active, ...commented]) {
      expect(line.split('=').slice(1).join('=')).not.toMatch(/^\//);
    }
    expect(toEnv(active)['SECRET_KEY_FILE']).toBe('~/.shopify-catalog-importer/secret.key');
  });
});

describe('version control', () => {
  function checkIgnore(path: string): number {
    try {
      execFileSync('git', ['check-ignore', '--quiet', '--', path], { cwd: root, stdio: 'ignore' });
      return 0;
    } catch (error) {
      return (error as { status?: number }).status ?? -1;
    }
  }

  // git check-ignore only matches the name against the ignore rules; it reads no file.
  it('ignores the real env file, whether or not it exists', () => {
    expect(checkIgnore('.env')).toBe(0);
  });

  it('does not ignore the sample', () => {
    expect(checkIgnore('env.example')).toBe(1);
  });
});
