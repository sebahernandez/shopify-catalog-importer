import Database from 'better-sqlite3';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { describe, expect, it } from 'vitest';

// Spike: the native driver installs, loads and runs (design items 4 and 7).
describe('native SQLite driver', () => {
  it('opens an in-memory database and runs SELECT 1', () => {
    const db = new Database(':memory:');
    try {
      expect(db.prepare('SELECT 1 AS one').get()).toEqual({ one: 1 });
    } finally {
      db.close();
    }
  });

  it('exposes the Prisma adapter factory', () => {
    const factory = new PrismaBetterSqlite3({ url: ':memory:' });
    expect(factory.provider).toBe('sqlite');
    expect(factory.adapterName).toBe('@prisma/adapter-better-sqlite3');
  });
});
