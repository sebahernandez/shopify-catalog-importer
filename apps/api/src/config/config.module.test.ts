import 'reflect-metadata';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Inject, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_CONFIG, ConfigModule } from './config.module.js';
import { ConfigError } from './env.schema.js';
import { loadConfig, type AppConfig, type LoadConfigOptions } from './load-config.js';

// Synthetic input only: the module is built with an explicit environment, workspace root and home
// directory, so no test here reads the real environment or the real home directory.
let sandbox: string;
let options: LoadConfigOptions;

beforeEach(async () => {
  sandbox = await mkdtemp(join(tmpdir(), 'importer-config-module-'));
  options = {
    env: { API_PORT: '4321', DATA_DIR: 'store' },
    envFile: join(sandbox, 'absent.env'),
    workspaceRoot: sandbox,
    home: join(sandbox, 'home'),
  };
});

afterEach(async () => {
  await rm(sandbox, { recursive: true, force: true });
});

// An explicit token, as in the U2 spike: no emitted decorator metadata is involved.
@Injectable()
class Consumer {
  constructor(@Inject(APP_CONFIG) readonly config: AppConfig) {}
}

describe('ConfigModule', () => {
  it('provides the loaded configuration under the APP_CONFIG token', async () => {
    @Module({ imports: [ConfigModule.forRoot(options)], providers: [Consumer] })
    class TestModule {}

    const context = await NestFactory.createApplicationContext(TestModule, { logger: false });
    try {
      const config = context.get<AppConfig>(APP_CONFIG, { strict: false });
      expect(config).toEqual(loadConfig(options));
      expect(config).toMatchObject({ apiPort: 4321, dataDir: join(sandbox, 'store') });
      expect(Object.isFrozen(config)).toBe(true);
    } finally {
      await context.close();
    }
  });

  it('injects the same frozen object into a consumer through the explicit token', async () => {
    @Module({ imports: [ConfigModule.forRoot(options)], providers: [Consumer] })
    class TestModule {}

    const context = await NestFactory.createApplicationContext(TestModule, { logger: false });
    try {
      expect(context.get(Consumer).config.apiPort).toBe(4321);
      expect(context.get(Consumer).config).toBe(
        context.get<AppConfig>(APP_CONFIG, { strict: false }),
      );
    } finally {
      await context.close();
    }
  });

  it('fails the module build with the schema error, names only', async () => {
    @Module({
      imports: [ConfigModule.forRoot({ ...options, env: { API_PORT: 'module-odd-seed' } })],
    })
    class BrokenModule {}

    const failure: unknown = await NestFactory.createApplicationContext(BrokenModule, {
      logger: false,
      // Nest calls process.abort() on a failed initialisation unless told not to.
      abortOnError: false,
    }).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(ConfigError);
    expect((failure as ConfigError).issues.map((issue) => issue.variable)).toEqual(['API_PORT']);
    expect((failure as ConfigError).message).not.toContain('module-odd-seed');
  });
});
