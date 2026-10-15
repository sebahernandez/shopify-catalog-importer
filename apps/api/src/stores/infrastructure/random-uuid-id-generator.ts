import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../ports/id-generator.port.js';

export class RandomUuidIdGenerator implements IdGenerator {
  next(): string {
    return randomUUID();
  }
}
