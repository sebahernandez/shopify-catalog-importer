import 'reflect-metadata';
import dns from 'node:dns';
import fs from 'node:fs';
import { request as httpRequest, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Module, type DynamicModule, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiError, ISSUE_CODES, ValidationReport } from '@importer/contracts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigModule } from '../../../config/config.module.js';
import { LocalSecurityModule } from '../../../local-security/local-security.module.js';
import { WORKBOOK_READER } from '../../application/catalog-workbook.tokens.js';
import { CatalogWorkbookModule } from '../../catalog-workbook.module.js';
import type { WorkbookLimits } from '../../domain/workbook-limits.js';
import type { WorkbookReader } from '../../ports/workbook-reader.port.js';
import { macroPart } from '../../test-support/workbook-fixture-builder.js';
import { buildWorkbook } from '../../test-support/workbook-fixture-builder.js';

// Tasks 13.4 and 13.5: the validate route over real HTTP, on an ephemeral loopback port. The
// module is booted alone with the global prefix main.ts sets; the origin case adds the guard.
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const MB = 1024 * 1024;

const SHEETS = (price = '10') => [
  {
    name: 'Productos',
    rows: [
      ['product_key', 'handle', 'titulo'],
      ['p-1', 'remera', 'Remera'],
    ],
  },
  {
    name: 'Variantes',
    rows: [
      ['product_key', 'sku', 'precio'],
      ['p-1', 'S1', price],
    ],
  },
  {
    name: 'Imagenes',
    rows: [
      ['product_key', 'archivo', 'orden'],
      ['p-1', 'a.jpg', '1'],
    ],
  },
];
const valid = (price?: string) => buildWorkbook(SHEETS(price));

let app: INestApplication | undefined;
let port = 0;

interface BootOptions {
  limits?: Partial<WorkbookLimits>;
  reader?: WorkbookReader;
  guarded?: boolean;
}

async function boot({ limits, reader, guarded = false }: BootOptions = {}): Promise<string> {
  const base = CatalogWorkbookModule.forRoot(limits === undefined ? {} : { limits });
  const workbook: DynamicModule = {
    ...base,
    providers: (base.providers ?? []).map((provider) =>
      reader !== undefined && 'provide' in provider && provider.provide === WORKBOOK_READER
        ? { provide: WORKBOOK_READER, useValue: reader }
        : provider,
    ),
  };
  const config = ConfigModule.forRoot({
    env: {},
    envFile: join(tmpdir(), 'importer-validate-test-absent.env'),
    home: join(tmpdir(), 'importer-validate-test-home'),
  });
  @Module({ imports: guarded ? [LocalSecurityModule.forRoot(config), workbook] : [workbook] })
  class TestAppModule {}

  app = await NestFactory.create(TestAppModule, { logger: false, abortOnError: false });
  app.setGlobalPrefix('api', { exclude: ['health'] });
  await app.listen(0, '127.0.0.1');
  port = ((app.getHttpServer() as Server).address() as AddressInfo).port;
  return `http://127.0.0.1:${port}/api/workbook`;
}

const post = (base: string, body?: Uint8Array, type: string | null = XLSX_TYPE) =>
  fetch(`${base}/validate`, {
    method: 'POST',
    ...(body === undefined ? {} : { body }),
    ...(type === null ? {} : { headers: { 'content-type': type } }),
  });

const upload = async (base: string, bytes: Buffer): Promise<ValidationReport> => {
  const response = await post(base, bytes);
  expect(response.status).toBe(200);
  return ValidationReport.parse(await response.json());
};

const expectApiError = async (response: Response, status: number, code: string) => {
  expect(response.status).toBe(status);
  expect(ApiError.parse(await response.json()).error.code).toBe(code);
};

afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.restoreAllMocks();
});

describe('POST api/workbook/validate request errors', () => {
  it('answers 400 WORKBOOK_FILE_REQUIRED for no body and for zero bytes', async () => {
    const base = await boot();
    await expectApiError(await post(base, undefined, null), 400, 'WORKBOOK_FILE_REQUIRED');
    await expectApiError(await post(base, new Uint8Array(0)), 400, 'WORKBOOK_FILE_REQUIRED');
  });

  it('answers 415 for a media type that is not the XLSX or the octet-stream type', async () => {
    const base = await boot();
    await expectApiError(
      await post(base, valid(), 'text/plain'),
      415,
      'WORKBOOK_UNSUPPORTED_MEDIA_TYPE',
    );
    expect((await post(base, valid(), 'application/octet-stream')).status).toBe(200);
  });

  it('answers 403 for a foreign origin and never reads the file', async () => {
    const read = vi.fn<WorkbookReader['read']>();
    const base = await boot({ guarded: true, reader: { read } });
    const status = await new Promise<number>((resolve, reject) => {
      const req = httpRequest(
        `${base}/validate`,
        {
          method: 'POST',
          headers: {
            host: '127.0.0.1:3000',
            origin: 'https://evil.example',
            'content-type': XLSX_TYPE,
          },
        },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on('error', reject);
      req.end(valid());
    });
    expect(status).toBe(403);
    expect(read).not.toHaveBeenCalled();
  });
});

describe('POST api/workbook/validate upload limit', () => {
  it('answers 413 at once for a Content-Length over 20 MB, before any body byte, and closes', async () => {
    // Only the headers are sent: the answer must not wait for the body (a full send would race
    // the close and could end in EPIPE on the client side).
    const base = await boot();
    const reply = await new Promise<{
      status: number;
      connection: string | undefined;
      body: string;
    }>((resolve, reject) => {
      const req = httpRequest(
        `${base}/validate`,
        {
          method: 'POST',
          headers: { 'content-type': XLSX_TYPE, 'content-length': `${20 * MB + 1}` },
        },
        (res) => {
          let body = '';
          res.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')));
          res.on('end', () =>
            resolve({ status: res.statusCode ?? 0, connection: res.headers.connection, body }),
          );
        },
      );
      req.on('error', reject);
      req.flushHeaders();
    });
    expect(reply).toMatchObject({ status: 413, connection: 'close' });
    expect(ApiError.parse(JSON.parse(reply.body)).error.code).toBe('WORKBOOK_TOO_LARGE');
  });

  it('answers 413 for a streamed body over 20 MB, draining what it does not keep', async () => {
    const base = await boot();
    const big = Buffer.alloc(20 * MB + 1, 1);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(big.subarray(0, 10 * MB));
        controller.enqueue(big.subarray(10 * MB));
        controller.close();
      },
    });
    const streamed = await fetch(`${base}/validate`, {
      method: 'POST',
      body: stream,
      duplex: 'half',
      headers: { 'content-type': XLSX_TYPE },
    });
    await expectApiError(streamed, 413, 'WORKBOOK_TOO_LARGE');
  });

  it('honours a configured 1 KB limit against a 2 KB file', async () => {
    const base = await boot({ limits: { maxUploadBytes: 1024 } });
    await expectApiError(await post(base, Buffer.alloc(2048, 1)), 413, 'WORKBOOK_TOO_LARGE');
  });

  it('accepts a valid workbook of 1 MB', async () => {
    const base = await boot();
    const padding = { name: 'docProps/padding.bin', data: randomBytes(MB) };
    const bytes = buildWorkbook(SHEETS(), [padding]);
    expect(bytes.byteLength).toBeGreaterThanOrEqual(MB);
    expect((await upload(base, bytes)).valid).toBe(true);
  });
});

describe('POST api/workbook/validate content problems', () => {
  it('reports a valid workbook as valid', async () => {
    expect(await upload(await boot(), valid())).toMatchObject({ valid: true, issues: [] });
  });

  it('answers 200 with PRICE_NEGATIVE for a negative price', async () => {
    const report = await upload(await boot(), valid('-5'));
    expect(report.summary.errorCount).toBeGreaterThanOrEqual(1);
    expect(report.issues.map(({ code }) => code)).toContain('PRICE_NEGATIVE');
  });

  it('answers 200 with a file-level FILE_NOT_XLSX for a text file named catalogo.xlsx', async () => {
    const report = await upload(await boot(), Buffer.from('plain text, not a workbook'));
    expect(report.issues.map(({ code, sheet }) => [code, sheet])).toEqual([
      ['FILE_NOT_XLSX', null],
    ]);
  });

  it('answers 200 with MACROS_NOT_ALLOWED for a package with a VBA project part', async () => {
    const report = await upload(await boot(), buildWorkbook(SHEETS(), [macroPart]));
    expect(report.issues.map(({ code }) => code)).toContain('MACROS_NOT_ALLOWED');
  });

  it('answers 200 with FILE_UNREADABLE and no stack when the reader throws', async () => {
    const reader: WorkbookReader = {
      read: () => Promise.reject(new Error('/srv/x boom\n at stack')),
    };
    const response = await post(await boot({ reader }), valid());
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(ValidationReport.parse(JSON.parse(text)).issues.map(({ code }) => code)).toEqual([
      'FILE_UNREADABLE',
    ]);
    expect(text).not.toMatch(/boom|stack|\/srv/);
  });
});

describe('POST api/workbook/validate statelessness and scope', () => {
  it('returns equal reports with the same fileSha256 for the same bytes', async () => {
    const base = await boot();
    const first = await upload(base, valid());
    expect(await upload(base, valid())).toEqual(first);
    expect(first.fileSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps nothing from an invalid upload in the next valid one', async () => {
    const base = await boot();
    const fresh = await upload(base, valid());
    await upload(base, valid('-5'));
    expect(await upload(base, valid())).toEqual(fresh);
  });

  it('fires no file write, network lookup or database access', async () => {
    const spies = [
      vi.spyOn(fs, 'writeFileSync'),
      vi.spyOn(fs, 'createWriteStream'),
      vi.spyOn(fs.promises, 'writeFile'),
      vi.spyOn(dns, 'lookup'),
    ];
    await upload(await boot(), valid());
    for (const spy of spies.slice(0, 3)) expect(spy).not.toHaveBeenCalled();
    // The test client resolves its own loopback literal; any other name would be a network call.
    expect(spies[3]?.mock.calls.every(([host]) => host === '127.0.0.1')).toBe(true);
  });

  it('is tier A only: a plain report with no Shopify claim or unknown code', async () => {
    const response = await post(await boot(), valid('-5'));
    const text = await response.text();
    const report: unknown = JSON.parse(text);
    expect(Object.keys(report as object).sort()).toEqual([
      'fileSha256',
      'issues',
      'summary',
      'truncated',
      'valid',
    ]);
    expect(text).not.toMatch(/shopify/i);
    for (const { code } of ValidationReport.parse(report).issues) {
      expect(ISSUE_CODES.safeParse(code).success).toBe(true);
    }
  });

  it('accepts the unmodified downloaded template with only EXAMPLE_PRODUCT warnings', async () => {
    const base = await boot();
    const template = Buffer.from(await (await fetch(`${base}/template`)).arrayBuffer());
    const report = await upload(base, template);
    expect(report.valid).toBe(true);
    expect(report.issues.map(({ code }) => code)).toEqual(['EXAMPLE_PRODUCT', 'EXAMPLE_PRODUCT']);
  });
});
