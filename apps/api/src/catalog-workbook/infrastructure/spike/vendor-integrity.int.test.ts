import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ROOT = new URL('../../../../../../', import.meta.url);
const TARBALL = 'vendor/sheetjs/xlsx-0.20.3.tgz';
const read = (path: string): Buffer => readFileSync(new URL(path, ROOT));
const digest = (algorithm: 'sha256' | 'sha512', encoding: 'hex' | 'base64'): string =>
  createHash(algorithm).update(read(TARBALL)).digest(encoding);

describe('vendored SheetJS tarball', () => {
  it('matches the SHA-256 recorded next to it', () => {
    const [hash, name] = read(`${TARBALL}.sha256`).toString('utf8').trim().split(/\s+/);
    expect(name).toBe('xlsx-0.20.3.tgz');
    expect(hash).toBe(digest('sha256', 'hex'));
  });

  it('matches the integrity pnpm recorded in the lockfile', () => {
    const lock = read('pnpm-lock.yaml').toString('utf8');
    const entry =
      /xlsx@file:vendor\/sheetjs\/xlsx-0\.20\.3\.tgz:\n\s+resolution: \{integrity: (sha512-[^,]+),/;
    expect(entry.exec(lock)?.[1]).toBe(`sha512-${digest('sha512', 'base64')}`);
  });

  it('keeps the Apache-2.0 license beside the tarball', () => {
    expect(read('vendor/sheetjs/LICENSE').toString('utf8')).toContain('Apache License');
  });
});
