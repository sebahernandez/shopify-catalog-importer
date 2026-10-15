import { ApiError, ImportRejected, ImportResponse, StoreSummary } from '@importer/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildWorkbook } from '../../../catalog-workbook/test-support/workbook-fixture-builder.js';
import { ImportCatalogUseCase } from '../../application/import-catalog.use-case.js';
import {
  ALLOWED_ORIGIN,
  bootStoreApp,
  forbidProcessExit,
  makeSandbox,
  removeSandbox,
  shopDomainOf,
  type Reply,
  type Sandbox,
  type StoreApp,
} from '../../test-support/store-app-harness.js';
import { ALL_SCOPES } from '../../test-support/store-use-case-harness.js';
import { CANARIES, canariesIn } from '../../test-support/canaries.js';

// The import route over real HTTP on the real application, the real workbook validation and the
// simulator gateway. The store token is a canary: it must appear nowhere in an answer or a log.
const TOKEN = CANARIES.staticToken;
const CREDS = { kind: 'static_token', accessToken: TOKEN } as const;
const BODY = { displayName: 'Demo', domain: 'demo', credentials: CREDS };
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const UNKNOWN = '99999999-9999-4999-8999-999999999999';
const SHOP = {
  name: 'Demo shop',
  currencyCode: 'USD',
  planName: 'Basic',
  shopifyPlus: false,
  partnerDevelopment: false,
  scopes: ALL_SCOPES,
  locations: [
    {
      id: 'gid://shopify/Location/1',
      name: 'Warehouse-Alpha',
      isActive: true,
      fulfillsOnlineOrders: true,
    },
    {
      id: 'gid://shopify/Location/2',
      name: 'Warehouse-Beta',
      isActive: true,
      fulfillsOnlineOrders: false,
    },
  ],
};

const PRODUCTOS = [
  'product_key',
  'handle',
  'titulo',
  'descripcion_html',
  'marca',
  'tipo',
  'etiquetas',
];
const VARIANTES = [
  'product_key',
  'sku',
  'precio',
  'precio_comparacion',
  'opcion1_nombre',
  'opcion1_valor',
  'gestionar_inventario',
  'stock',
  'ubicacion',
];
const IMAGENES = ['product_key', 'archivo', 'orden', 'alt'];

const workbook = (price = '10') =>
  buildWorkbook([
    {
      name: 'Productos',
      rows: [
        PRODUCTOS,
        ['p-1', 'remera', 'Remera', '<p>Hola</p>', 'Acme', 'Ropa', 'verano, nuevo'],
        ['p-2', 'gorra', 'Gorra', '', '', '', ''],
      ],
    },
    {
      name: 'Variantes',
      rows: [
        VARIANTES,
        ['p-1', 'R-S', price, '12.5', 'Talla', 'S', 'TRUE', '4', 'warehouse-alpha'],
        ['p-1', 'R-M', price, '', 'Talla', 'M', 'FALSE', '', ''],
        ['p-2', 'G-1', '5', '', '', '', 'FALSE', '', ''],
      ],
      textColumns: [1],
    },
    {
      name: 'Imagenes',
      rows: [
        IMAGENES,
        ['p-1', 'https://cdn.example.com/remera.jpg', '1', 'Remera'],
        ['p-1', 'fotos/local.jpg', '2', ''],
      ],
    },
  ]);

let sandbox: Sandbox;
let app: StoreApp;

interface Json {
  error?: { code: string };
}
const json = (reply: Reply): Json => JSON.parse(reply.body) as Json;
const noStore = (reply: Reply) => expect(reply.headers['cache-control']).toBe('no-store');
const upload = (bytes: Buffer, headers: Record<string, string> = {}) => ({
  body: bytes,
  headers: { 'content-type': XLSX, ...headers },
});
const writes = () => app.simulator.calls.filter((call) => call === 'createProduct');

async function connectedStore(): Promise<string> {
  const created = await app.send('POST', '/api/stores', { json: BODY });
  const { id } = StoreSummary.parse(json(created));
  expect((await app.send('POST', `/api/stores/${id}/verify`)).status).toBe(200);
  app.simulator.calls.length = 0;
  return id;
}

beforeEach(async () => {
  forbidProcessExit();
  sandbox = await makeSandbox();
  app = await bootStoreApp(sandbox);
  app.simulator.addShop(shopDomainOf('demo.myshopify.com'), SHOP);
});
afterEach(async () => {
  await app.close();
  vi.restoreAllMocks();
  await removeSandbox(sandbox);
});

describe('importing a valid workbook', () => {
  it('creates the products as the simulator sees them and answers the contract shape', async () => {
    const id = await connectedStore();
    const reply = await app.send('POST', `/api/stores/${id}/import`, upload(workbook()));
    expect(reply.status).toBe(200);
    noStore(reply);
    const result = ImportResponse.parse(json(reply));
    expect(result.totals).toEqual({ products: 2, created: 2, failed: 0 });
    expect(result.results[0]).toMatchObject({
      productKey: 'p-1',
      status: 'created',
      imagesSkipped: { localFile: 1, overLimit: 0 },
      mediaStatuses: ['UPLOADED'],
    });
    expect(app.simulator.calls).toEqual(['listLocations', 'createProduct', 'createProduct']);

    const [first, second] = app.simulator.createdProducts(shopDomainOf('demo.myshopify.com'));
    expect(first?.input).toMatchObject({
      title: 'Remera',
      handle: 'remera',
      descriptionHtml: '<p>Hola</p>',
      vendor: 'Acme',
      productType: 'Ropa',
      tags: ['verano', 'nuevo'],
      options: [{ name: 'Talla', values: ['S', 'M'] }],
      images: [{ url: 'https://cdn.example.com/remera.jpg', alt: 'Remera' }],
    });
    expect(first?.input.variants[0]).toMatchObject({
      price: '10',
      compareAtPrice: '12.5',
      tracked: true,
      inventory: { locationId: 'gid://shopify/Location/1', quantity: 4 },
    });
    expect(first?.input.variants[1]).toMatchObject({ tracked: false });
    expect(first?.input.variants[1]).not.toHaveProperty('inventory');
    expect(second?.input.options).toEqual([{ name: 'Title', values: ['Default Title'] }]);
  });

  it('reports a handle that is already taken as that product only, on a second run', async () => {
    const id = await connectedStore();
    await app.send('POST', `/api/stores/${id}/import`, upload(workbook()));
    const again = await app.send('POST', `/api/stores/${id}/import`, upload(workbook()));
    expect(again.status).toBe(200);
    const result = ImportResponse.parse(json(again));
    expect(result.totals).toEqual({ products: 2, created: 0, failed: 2 });
    expect(result.results.map((r) => (r.status === 'failed' ? r.failure.code : 'created'))).toEqual(
      ['HANDLE_TAKEN', 'HANDLE_TAKEN'],
    );
    expect(result.stoppedEarly).toBe(false);
  });
});

describe('what is refused before Shopify is called', () => {
  it('answers 422 with the report and sends nothing when the workbook has errors', async () => {
    const id = await connectedStore();
    const reply = await app.send('POST', `/api/stores/${id}/import`, upload(workbook('abc')));
    expect(reply.status).toBe(422);
    noStore(reply);
    const body = ImportRejected.parse(json(reply));
    expect(body.report.valid).toBe(false);
    expect(body.report.summary.errorCount).toBeGreaterThan(0);
    expect(app.simulator.calls).toEqual([]);
  });

  it('answers 409 for a store that was never verified', async () => {
    const created = await app.send('POST', '/api/stores', { json: BODY });
    const { id } = StoreSummary.parse(json(created));
    const reply = await app.send('POST', `/api/stores/${id}/import`, upload(workbook()));
    expect(reply.status).toBe(409);
    expect(json(reply).error?.code).toBe('STORE_NOT_CONNECTED');
    noStore(reply);
    expect(app.simulator.calls).toEqual([]);
  });

  it('answers 409 for a store whose last verification failed', async () => {
    const created = await app.send('POST', '/api/stores', { json: BODY });
    const { id } = StoreSummary.parse(json(created));
    app.simulator.faults.always('getShopInfo', { kind: 'AUTH_FAILED' });
    await app.send('POST', `/api/stores/${id}/verify`);
    app.simulator.calls.length = 0;
    const reply = await app.send('POST', `/api/stores/${id}/import`, upload(workbook()));
    expect(reply.status).toBe(409);
    expect(app.simulator.calls).toEqual([]);
  });

  it.each([UNKNOWN, 'not-an-id'])('answers 404 for the store %s', async (id) => {
    const reply = await app.send('POST', `/api/stores/${id}/import`, upload(workbook()));
    expect(reply.status).toBe(404);
    expect(ApiError.parse(json(reply)).error.code).toBe('STORE_NOT_FOUND');
    noStore(reply);
  });

  it('answers 415 for a JSON body and 400 for an empty one', async () => {
    const id = await connectedStore();
    const wrong = await app.send('POST', `/api/stores/${id}/import`, { json: {} });
    expect(wrong.status).toBe(415);
    expect(json(wrong).error?.code).toBe('WORKBOOK_UNSUPPORTED_MEDIA_TYPE');
    const empty = await app.send('POST', `/api/stores/${id}/import`, {
      headers: { 'content-type': XLSX },
    });
    expect(empty.status).toBe(400);
    expect(json(empty).error?.code).toBe('WORKBOOK_FILE_REQUIRED');
    expect(app.simulator.calls).toEqual([]);
  });

  it('answers a file that is not a workbook with 422 and its report', async () => {
    const id = await connectedStore();
    const reply = await app.send('POST', `/api/stores/${id}/import`, upload(Buffer.from('nope')));
    expect(reply.status).toBe(422);
    expect(app.simulator.calls).toEqual([]);
  });
});

describe('origin and host guards', () => {
  it('answers 403 ORIGIN_NOT_ALLOWED with no use case, no body read and no Shopify call', async () => {
    const id = await connectedStore();
    const handler = vi.spyOn(ImportCatalogUseCase.prototype, 'execute');
    const reply = await app.send(
      'POST',
      `/api/stores/${id}/import`,
      upload(workbook(), { origin: 'https://evil.example' }),
    );
    expect(reply.status).toBe(403);
    expect(json(reply).error?.code).toBe('ORIGIN_NOT_ALLOWED');
    noStore(reply);
    expect(handler).not.toHaveBeenCalled();
    expect(app.simulator.calls).toEqual([]);
  });

  it('refuses a cross-site request that has no Origin', async () => {
    const id = await connectedStore();
    const reply = await app.send(
      'POST',
      `/api/stores/${id}/import`,
      upload(workbook(), { 'sec-fetch-site': 'cross-site' }),
    );
    expect(reply.status).toBe(403);
    expect(app.simulator.calls).toEqual([]);
  });

  it('refuses a disallowed Host', async () => {
    const id = await connectedStore();
    const reply = await app.send('POST', `/api/stores/${id}/import`, {
      ...upload(workbook()),
      host: 'evil.example',
    });
    expect(reply.status).toBe(403);
    expect(json(reply).error?.code).toBe('HOST_NOT_ALLOWED');
    expect(app.simulator.calls).toEqual([]);
  });

  it('processes an allow-listed origin', async () => {
    const id = await connectedStore();
    const reply = await app.send(
      'POST',
      `/api/stores/${id}/import`,
      upload(workbook(), { origin: ALLOWED_ORIGIN }),
    );
    expect(reply.status).toBe(200);
  });
});

describe('failures and secrets', () => {
  it('stops on a credentials failure, never retries a write and leaks nothing', async () => {
    const id = await connectedStore();
    app.simulator.faults.on('createProduct', 1, { kind: 'AUTH_FAILED' });
    const reply = await app.send('POST', `/api/stores/${id}/import`, upload(workbook()));
    expect(reply.status).toBe(200);
    const result = ImportResponse.parse(json(reply));
    expect(result.stoppedEarly).toBe(true);
    expect(result.results.map((r) => (r.status === 'failed' ? r.failure.code : 'created'))).toEqual(
      ['STORE_ACCESS_FAILED', 'NOT_ATTEMPTED'],
    );
    expect(writes()).toHaveLength(1);
    expect(reply.body + app.lines.join('\n')).not.toContain(TOKEN);
  });

  it('answers a Shopify failure while reading locations with 502 and creates nothing', async () => {
    const id = await connectedStore();
    app.simulator.faults.always('listLocations', { kind: 'SERVER_ERROR' });
    const reply = await app.send('POST', `/api/stores/${id}/import`, upload(workbook()));
    expect(reply.status).toBe(502);
    expect(json(reply).error?.code).toBe('SHOPIFY_REQUEST_FAILED');
    noStore(reply);
    expect(writes()).toHaveLength(0);
  });

  it('keeps an unexpected error message, with a canary in it, out of answers and logs', async () => {
    const id = await connectedStore();
    vi.spyOn(app.simulator, 'createProduct').mockRejectedValue(
      new Error(`boom ${CANARIES.shopifyShaped} ${TOKEN}`),
    );
    const reply = await app.send('POST', `/api/stores/${id}/import`, upload(workbook()));
    expect(reply.status).toBe(200);
    expect(ImportResponse.parse(json(reply)).stoppedEarly).toBe(true);
    expect(canariesIn(reply.body + JSON.stringify(reply.headers) + app.lines.join('\n'))).toEqual(
      [],
    );
  });

  it('keeps the token out of every answer and log of a successful import', async () => {
    const id = await connectedStore();
    const reply = await app.send('POST', `/api/stores/${id}/import`, upload(workbook()));
    expect(canariesIn(reply.body + JSON.stringify(reply.headers) + app.lines.join('\n'))).toEqual(
      [],
    );
    expect(app.lines.some((line) => line.includes('store_import_finished'))).toBe(true);
  });
});
