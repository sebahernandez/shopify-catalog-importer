import 'reflect-metadata';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ValidationReport } from '@importer/contracts';
import { afterEach, describe, expect, it } from 'vitest';
import { CatalogWorkbookModule } from '../../catalog-workbook.module.js';
import { buildWorkbook } from '../../test-support/workbook-fixture-builder.js';

// Task 13.6: a 5,000-variant workbook validates through the route in at most 5 s.
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PRODUCTS = 500;
const VARIANTS_PER_PRODUCT = 10;
const BUDGET_MS = 5_000;

const range = (count: number) => Array.from({ length: count }, (_, index) => index + 1);
const productKey = (product: number) => `p-${product}`;

const bigWorkbook = () =>
  buildWorkbook([
    {
      name: 'Productos',
      rows: [
        ['product_key', 'handle', 'titulo'],
        ...range(PRODUCTS).map((n) => [productKey(n), `producto-${n}`, `Producto ${n}`]),
      ],
    },
    {
      name: 'Variantes',
      rows: [
        ['product_key', 'sku', 'precio', 'opcion1_nombre', 'opcion1_valor'],
        ...range(PRODUCTS).flatMap((n) =>
          range(VARIANTS_PER_PRODUCT).map((v) => [
            productKey(n),
            `SKU-${n}-${v}`,
            `${10 + v}`,
            'Talla',
            `T${v}`,
          ]),
        ),
      ],
    },
    {
      name: 'Imagenes',
      rows: [
        ['product_key', 'archivo', 'orden'],
        ...range(PRODUCTS).map((n) => [productKey(n), `img-${n}.jpg`, '1']),
      ],
    },
  ]);

let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('POST api/workbook/validate performance', () => {
  it('validates a 5,000-variant workbook within 5 seconds', { timeout: 60_000 }, async () => {
    @Module({ imports: [CatalogWorkbookModule.forRoot({})] })
    class PerfAppModule {}
    app = await NestFactory.create(PerfAppModule, { logger: false, abortOnError: false });
    app.setGlobalPrefix('api', { exclude: ['health'] });
    await app.listen(0, '127.0.0.1');
    const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
    const bytes = bigWorkbook();

    const started = performance.now();
    const response = await fetch(`http://127.0.0.1:${port}/api/workbook/validate`, {
      method: 'POST',
      body: bytes,
      headers: { 'content-type': XLSX_TYPE },
    });
    const report = ValidationReport.parse(await response.json());
    const elapsed = performance.now() - started;

    console.info(
      `validate-perf: ${PRODUCTS * VARIANTS_PER_PRODUCT} variants, ${bytes.length} bytes, ${Math.round(elapsed)} ms`,
    );
    expect(response.status).toBe(200);
    expect(report.summary.errorCount).toBe(0);
    expect(report).toMatchObject({ valid: true });
    expect(elapsed).toBeLessThanOrEqual(BUDGET_MS);
  });
});
