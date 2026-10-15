import { describe, expect, it } from 'vitest';
import { EXPECTED_TABLES } from './expected-tables.js';

describe('EXPECTED_TABLES', () => {
  it('lists exactly the tables the application needs', () => {
    expect([...EXPECTED_TABLES]).toEqual(['app_setting', 'store']);
  });
});
