import 'reflect-metadata';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Controller, Get, Inject, Module, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';

// Spike: native ESM boot (design item 1) and explicit-token DI under the test
// transform without emitted decorator metadata (design item 2).
const GREETING = Symbol('GREETING');

@Controller('spike')
class SpikeController {
  // No emitDecoratorMetadata: the explicit token is the only way this resolves.
  constructor(@Inject(GREETING) private readonly greeting: string) {}

  @Get()
  read(): { greeting: string } {
    return { greeting: this.greeting };
  }
}

@Module({
  imports: [AppModule],
  controllers: [SpikeController],
  providers: [{ provide: GREETING, useValue: 'hello' }],
})
class SpikeModule {}

describe('native ESM boot', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    app = await NestFactory.create(SpikeModule, { logger: false });
    await app.listen(0, '127.0.0.1');
    const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers on an ephemeral loopback port', async () => {
    const response = await fetch(`${baseUrl}/spike`);
    expect(response.status).toBe(200);
  });

  it('resolves a provider injected through an explicit token', async () => {
    const response = await fetch(`${baseUrl}/spike`);
    expect(await response.json()).toEqual({ greeting: 'hello' });
  });
});
