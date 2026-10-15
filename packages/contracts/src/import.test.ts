import { describe, expect, it } from 'vitest';
import {
  IMPORT_FAILURE_CODES,
  ImportProductResult,
  ImportRejected,
  ImportResponse,
} from './import.js';

const created = {
  productKey: 'P1',
  handle: 'camiseta',
  status: 'created',
  productId: 'gid://shopify/Product/1',
  shopifyHandle: 'camiseta',
  mediaStatuses: ['UPLOADED', 'READY'],
  imagesSkipped: { localFile: 1, overLimit: 0 },
  warnings: [],
};
const failed = {
  productKey: 'P2',
  handle: 'otra',
  status: 'failed',
  failure: {
    code: 'HANDLE_TAKEN',
    message: 'The handle is already used.',
    details: [{ field: 'input.handle', code: 'TAKEN' }],
  },
};

describe('ImportProductResult', () => {
  it('accepts a created and a failed product', () => {
    expect(ImportProductResult.parse(created)).toEqual(created);
    expect(ImportProductResult.parse(failed)).toEqual(failed);
  });

  it('rejects unknown members, so nothing extra can leak out', () => {
    expect(ImportProductResult.safeParse({ ...created, token: 'x' }).success).toBe(false);
    expect(
      ImportProductResult.safeParse({ ...failed, failure: { ...failed.failure, raw: '{}' } })
        .success,
    ).toBe(false);
  });

  it('rejects a created product without an id and an unknown failure code', () => {
    expect(ImportProductResult.safeParse({ ...created, productId: '' }).success).toBe(false);
    expect(
      ImportProductResult.safeParse({ ...failed, failure: { ...failed.failure, code: 'BOOM' } })
        .success,
    ).toBe(false);
  });

  it('lists the closed set of failure codes', () => {
    expect(IMPORT_FAILURE_CODES.options).toContain('OUTCOME_UNKNOWN');
    expect(IMPORT_FAILURE_CODES.options).toContain('NOT_ATTEMPTED');
  });
});

describe('ImportResponse', () => {
  it('accepts totals, the stop flag and results', () => {
    const body = {
      totals: { products: 2, created: 1, failed: 1 },
      stoppedEarly: false,
      results: [created, failed],
    };
    expect(ImportResponse.parse(body)).toEqual(body);
  });

  it('rejects a negative total', () => {
    expect(
      ImportResponse.safeParse({
        totals: { products: 1, created: -1, failed: 0 },
        stoppedEarly: false,
        results: [],
      }).success,
    ).toBe(false);
  });
});

describe('ImportRejected', () => {
  it('carries the validation report next to the error', () => {
    const report = {
      valid: false,
      fileSha256: 'a'.repeat(64),
      summary: { errorCount: 1, warningCount: 0 },
      truncated: false,
      issues: [],
    };
    const body = { error: { code: 'WORKBOOK_INVALID', message: 'm' }, report };
    expect(ImportRejected.safeParse(body).success).toBe(true);
    expect(ImportRejected.safeParse({ error: body.error }).success).toBe(false);
  });
});
