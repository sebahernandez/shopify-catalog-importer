import 'reflect-metadata';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { CatalogWorkbookModule } from '../../catalog-workbook.module.js';

// Task 12.6: the template download over real HTTP, on an ephemeral loopback port. The module under
// test is booted alone with the same global prefix main.ts sets, so the route is api/workbook/template.
const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

let app: INestApplication | undefined;

async function boot(): Promise<string> {
  app = await NestFactory.create(CatalogWorkbookModule.forRoot(), { logger: false });
  app.setGlobalPrefix('api', { exclude: ['health'] });
  await app.listen(0, '127.0.0.1');
  const server = app.getHttpServer() as Server;
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}/api/workbook/template`;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('GET api/workbook/template', () => {
  it('answers 200 with the XLSX type, an attachment name and no-store', async () => {
    const response = await fetch(await boot());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(XLSX_TYPE);
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename="?[^"]+\.xlsx"?/,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('returns a ZIP package and the same bytes on every download', async () => {
    const url = await boot();
    const first = new Uint8Array(await (await fetch(url)).arrayBuffer());
    const second = new Uint8Array(await (await fetch(url)).arrayBuffer());
    expect([...first.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(Buffer.from(second).equals(Buffer.from(first))).toBe(true);
  });
});
