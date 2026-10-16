import { describe, expect, it, vi } from 'vitest';
import { STORE_ID, importResponse, INVALID_REPORT, report } from '../test-fixtures';
import {
  IMPORT_TIMEOUT_MS,
  XLSX_CONTENT_TYPE,
  downloadTemplate,
  importCatalog,
  validateWorkbook,
} from './workbook-client';

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function fake(response: Response) {
  return vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
    Promise.resolve(response),
  );
}

const FILE = new Blob([new Uint8Array([80, 75, 3, 4])]);

describe('workbook client', () => {
  it('posts the raw file, not multipart, with the xlsx content type', async () => {
    const fetchFn = fake(json(200, report()));
    await expect(validateWorkbook(FILE, { fetchFn })).resolves.toEqual({
      ok: true,
      data: report(),
    });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe('/api/workbook/validate');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(FILE);
    expect(init?.body).not.toBeInstanceOf(FormData);
    expect(init?.headers).toEqual({ 'content-type': XLSX_CONTENT_TYPE });
  });

  it('returns an invalid report as a successful validation', async () => {
    await expect(
      validateWorkbook(FILE, { fetchFn: fake(json(200, INVALID_REPORT)) }),
    ).resolves.toEqual({
      ok: true,
      data: INVALID_REPORT,
    });
  });

  it.each([
    ['WORKBOOK_TOO_LARGE', 413],
    ['WORKBOOK_UNSUPPORTED_MEDIA_TYPE', 415],
    ['WORKBOOK_FILE_REQUIRED', 400],
  ])('maps the upload rejection %s', async (code, status) => {
    const result = await validateWorkbook(FILE, {
      fetchFn: fake(json(status, { error: { code, message: 'm' } })),
    });
    expect(result).toMatchObject({ ok: false, failure: { kind: 'api', status, code } });
  });

  it('downloads the template as a blob from the template route', async () => {
    const fetchFn = fake(new Response('xlsx-bytes', { status: 200 }));
    const result = await downloadTemplate({ fetchFn });
    expect(fetchFn.mock.calls[0]?.[0]).toBe('/api/workbook/template');
    expect(fetchFn.mock.calls[0]?.[1].method).toBe('GET');
    expect(result.ok && result.data instanceof Blob).toBe(true);
  });

  it('imports with the same raw body on the store route and a generous timeout', async () => {
    const fetchFn = fake(json(200, importResponse()));
    await expect(importCatalog(STORE_ID, FILE, { fetchFn })).resolves.toEqual({
      ok: true,
      data: importResponse(),
    });
    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe(`/api/stores/${STORE_ID}/import`);
    expect(init?.body).toBe(FILE);
    expect(init?.headers).toEqual({ 'content-type': XLSX_CONTENT_TYPE });
    expect(IMPORT_TIMEOUT_MS).toBeGreaterThanOrEqual(10 * 60 * 1000);
  });

  it('keeps the report when the API rejects the workbook (422)', async () => {
    const body = { error: { code: 'WORKBOOK_INVALID', message: 'm' }, report: INVALID_REPORT };
    const result = await importCatalog(STORE_ID, FILE, { fetchFn: fake(json(422, body)) });
    expect(result).toEqual({
      ok: false,
      failure: { kind: 'api', status: 422, code: 'WORKBOOK_INVALID', report: INVALID_REPORT },
    });
  });

  it.each([
    ['STORE_NOT_CONNECTED', 409],
    ['SHOPIFY_REQUEST_FAILED', 502],
    ['STORE_NOT_FOUND', 404],
  ])('maps the import error %s', async (code, status) => {
    const result = await importCatalog(STORE_ID, FILE, {
      fetchFn: fake(json(status, { error: { code, message: 'm' } })),
    });
    expect(result).toMatchObject({ ok: false, failure: { code, status } });
  });

  it('rejects an import answer that does not match the contract', async () => {
    const result = await importCatalog(STORE_ID, FILE, {
      fetchFn: fake(json(200, { totals: { products: 1 } })),
    });
    expect(result).toMatchObject({ ok: false, failure: { kind: 'invalid_response' } });
  });

  it('answers aborted when the user cancels the wait', async () => {
    const controller = new AbortController();
    const pending = importCatalog(STORE_ID, FILE, {
      fetchFn: () => new Promise<Response>(() => undefined),
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).resolves.toEqual({ ok: false, failure: { kind: 'aborted' } });
  });
});
