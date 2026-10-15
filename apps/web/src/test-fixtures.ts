import type {
  ImportResponse,
  StoreSummary,
  StoreVerification,
  ValidationReport,
} from '@importer/contracts';

// Builders for the tests only: nothing in the shipped bundle imports this file.

export const STORE_ID = '3f2b8c1e-5d4a-4e7b-9c1d-2a6f8b0e4d11';
export const OTHER_STORE_ID = '9a1c7e52-0b3d-4f68-8e2a-5c4d1b7f3a90';

export function storeSummary(overrides: Partial<StoreSummary> = {}): StoreSummary {
  return {
    id: STORE_ID,
    displayName: 'Mi tienda',
    shopDomain: 'mi-tienda.myshopify.com',
    shopifyShopId: null,
    apiVersion: null,
    authKind: 'static_token',
    status: 'UNVERIFIED',
    hasCredentials: true,
    lastVerifiedAt: null,
    lastVerification: null,
    createdAt: '2026-10-15T12:00:00.000Z',
    updatedAt: '2026-10-15T12:00:00.000Z',
    ...overrides,
  };
}

export function verification(overrides: Partial<StoreVerification> = {}): StoreVerification {
  return {
    ok: true,
    checkedAt: '2026-10-15T12:00:00.000Z',
    shop: null,
    apiVersion: { requested: '2026-10', used: '2026-10' },
    scopes: { granted: [], required: [], missing: [] },
    locationsTruncated: false,
    problems: [],
    locations: [],
    ...overrides,
  };
}

export function report(overrides: Partial<ValidationReport> = {}): ValidationReport {
  return {
    valid: true,
    fileSha256: 'a'.repeat(64),
    summary: { errorCount: 0, warningCount: 0 },
    truncated: false,
    issues: [],
    ...overrides,
  };
}

export const INVALID_REPORT: ValidationReport = report({
  valid: false,
  summary: { errorCount: 1, warningCount: 0 },
  issues: [
    {
      severity: 'error',
      code: 'REQUIRED_FIELD_MISSING',
      params: { field: 'titulo' },
      sheet: 'Productos',
      row: 4,
      field: 'titulo',
      productKey: null,
      message: 'x',
      suggestedAction: 'y',
    },
  ],
});

export function importResponse(overrides: Partial<ImportResponse> = {}): ImportResponse {
  return {
    totals: { products: 2, created: 1, failed: 1 },
    stoppedEarly: false,
    results: [
      {
        status: 'created',
        productKey: 'camisa',
        handle: 'camisa-roja',
        productId: 'gid://shopify/Product/1',
        shopifyHandle: 'camisa-roja-1',
        mediaStatuses: ['UPLOADED'],
        imagesSkipped: { localFile: 2, overLimit: 0 },
        warnings: [],
      },
      {
        status: 'failed',
        productKey: 'pantalon',
        handle: 'pantalon-azul',
        failure: {
          code: 'HANDLE_TAKEN',
          message: 'taken',
          details: [{ field: 'handle', code: 'TAKEN' }],
        },
      },
    ],
    ...overrides,
  };
}
