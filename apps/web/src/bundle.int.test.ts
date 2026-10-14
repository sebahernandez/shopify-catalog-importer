import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { es } from './i18n/es';

const webRoot = fileURLToPath(new URL('..', import.meta.url));
const workspaceRoot = resolve(webRoot, '..', '..');

// A synthetic value, not a real secret. The name has no VITE_ prefix, so Vite must never expose it.
const SEED_NAME = 'IMPORTER_TEST_SEEDED_SECRET';
const SEED_VALUE = 'seeded-secret-7f3a9c1e-not-a-real-credential';

// URLs that are text inside a file, not a request: XML namespaces, the Tailwind licence banner
// (a CSS comment), the React error-decoder message, and two identifiers inside zod (the web
// bundle carries zod through the contracts package): JSON Schema dialect names and a template
// used to build a host pattern. Nothing else may appear in any file.
const NAMESPACE_URL = /^http:\/\/www\.w3\.org\//;
const ALLOWED_URLS = {
  html: [NAMESPACE_URL],
  css: [NAMESPACE_URL, /^https:\/\/tailwindcss\.com$/],
  js: [
    NAMESPACE_URL,
    /^https:\/\/react\.dev\/errors\//,
    /^https?:\/\/json-schema\.org\/draft(?:\/2020-12|-07|-04)\/schema#?$/,
    /^http:\/\/\[\$\{\w+\}\]$/,
  ],
};

let outDir = '';
let files: { name: string; text: string }[] = [];

function urlsIn(text: string): string[] {
  return text.match(/https?:\/\/[^\s"'`)<>\\]+/g) ?? [];
}

function filesWith(extension: string) {
  return files.filter((file) => file.name.endsWith(extension));
}

beforeAll(async () => {
  outDir = await mkdtemp(join(tmpdir(), 'importer-web-bundle-'));
  vi.stubEnv(SEED_NAME, SEED_VALUE);
  // Vitest sets NODE_ENV to test, and Vite honours it: without this the build would be a
  // development build (development React, file paths in the output).
  vi.stubEnv('NODE_ENV', 'production');
  await build({
    root: webRoot,
    configFile: join(webRoot, 'vite.config.ts'),
    mode: 'production',
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true },
  });
  const entries = await readdir(outDir, { recursive: true, withFileTypes: true });
  files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const path = join(entry.parentPath, entry.name);
        return { name: path.slice(outDir.length + 1), text: await readFile(path, 'utf8') };
      }),
  );
}, 60_000);

afterAll(async () => {
  vi.unstubAllEnvs();
  if (outDir) await rm(outDir, { recursive: true, force: true });
});

describe('production bundle', () => {
  it('emits an HTML page, JavaScript and CSS that contain the shell', () => {
    expect(filesWith('.html')).toHaveLength(1);
    expect(filesWith('.js').length).toBeGreaterThan(0);
    expect(filesWith('.css').length).toBeGreaterThan(0);
    expect(filesWith('.js').some((file) => file.text.includes('Shopify Catalog Importer'))).toBe(
      true,
    );
  });

  it('contains no server-side package name or path', () => {
    for (const file of files) {
      expect(file.text, file.name).not.toContain('@importer/api');
      expect(file.text, file.name).not.toContain('apps/api');
    }
  });

  it('contains neither the seeded secret nor any environment access', () => {
    for (const file of files) {
      expect(file.text, file.name).not.toContain(SEED_VALUE);
      expect(file.text, file.name).not.toContain(SEED_NAME);
      expect(file.text, file.name).not.toContain('process.env');
    }
  });

  it('ships no source map and no path of this machine', () => {
    expect(files.filter((file) => file.name.endsWith('.map'))).toEqual([]);
    for (const file of files) {
      expect(file.text, file.name).not.toContain('sourceMappingURL');
      for (const local of [workspaceRoot, homedir(), outDir]) {
        expect(file.text, file.name).not.toContain(local);
      }
    }
  });

  it('requests nothing from a third-party origin', () => {
    for (const [extension, allowed] of Object.entries(ALLOWED_URLS)) {
      const group = filesWith(`.${extension}`);
      expect(group.length, extension).toBeGreaterThan(0);
      for (const file of group) {
        const unexpected = urlsIn(file.text).filter((url) => !allowed.some((ok) => ok.test(url)));
        expect(unexpected, file.name).toEqual([]);
      }
    }
  });

  it('keeps the page language, title and one same-origin module script', () => {
    const [page] = filesWith('.html');
    expect(page?.text).toMatch(/<html[^>]*\slang="es"/);
    expect(page?.text).toMatch(/<title>[^<]*Shopify Catalog Importer[^<]*<\/title>/);
    const scripts = [...(page?.text.matchAll(/<script\b[^>]*>/g) ?? [])].map((match) => match[0]);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toMatch(/\ssrc="\/assets\/[^"]+\.js"/);
    expect(page?.text).not.toMatch(/<script\b[^>]*>[^<]+<\/script>/);
  });

  it('contains the Spanish copy of the health page and the relative health route', () => {
    const script = filesWith('.js')
      .map((file) => file.text)
      .join('\n');
    for (const text of [
      es.product,
      es.health.heading,
      ...Object.values(es.health.states),
      es.health.version('x').replace(/x$/, ''),
    ]) {
      expect(script, text).toContain(text);
    }
    expect(script).toMatch(/["'`]\/health["'`]/);
  });

  it('names no API host or port anywhere in the built files', () => {
    for (const file of files) {
      for (const literal of ['127.0.0.1', 'localhost', ':3000']) {
        expect(file.text, `${file.name} ${literal}`).not.toContain(literal);
      }
    }
  });
});
