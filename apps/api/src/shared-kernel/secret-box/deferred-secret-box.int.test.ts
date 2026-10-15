import 'reflect-metadata';
import { Inject, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { DeferredSecretBox } from './deferred-secret-box.js';
import { AesGcmSecretBox } from './infrastructure/aes-gcm-secret-box.js';
import type { SecretBox } from './secret-box.port.js';

// VS6 (design D4): Nest keeps the very instance given as `useValue`, so a box bound after the
// application exists is the box every consumer resolves.
const SECRET_BOX = Symbol('SECRET_BOX');
const holder = new DeferredSecretBox();

@Injectable()
class Consumer {
  constructor(@Inject(SECRET_BOX) readonly box: SecretBox) {}
}

@Module({ providers: [{ provide: SECRET_BOX, useValue: holder }, Consumer] })
class ProbeModule {}

describe('VS6: the holder survives Nest creation', () => {
  it('resolves the same instance and the bound box at call time', async () => {
    const app = await NestFactory.createApplicationContext(ProbeModule, { logger: false });
    try {
      const consumer = app.get(Consumer);
      expect(consumer.box).toBe(holder);
      expect(app.get<SecretBox>(SECRET_BOX)).toBe(holder);
      expect(() => consumer.box.encrypt('synthetic-value-0003', 'c')).toThrow(/not ready/);
      holder.bind(
        new AesGcmSecretBox({ activeKeyId: 'k1', keys: new Map([['k1', Buffer.alloc(32, 4)]]) }),
      );
      const envelope = consumer.box.encrypt('synthetic-value-0003', 'c');
      expect(consumer.box.decrypt(envelope, 'c')).toBe('synthetic-value-0003');
    } finally {
      await app.close();
    }
  });
});
