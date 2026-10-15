import { describe, expect, it } from 'vitest';
import {
  GRANTED_SCOPES_OPERATION,
  LOCATIONS_OPERATION,
  SHOP_INFO_OPERATION,
} from './graphql-operations.js';
import { grantedScopesSchema, locationsPageSchema, shopInfoSchema } from './response-schemas.js';
import { grantedScopesBody } from '../../test-support/fixtures/granted-scopes.js';
import {
  emptyLocationsBody,
  locations251Pages,
  threeActiveBody,
} from '../../test-support/fixtures/locations.js';
import {
  healthyShopBody,
  shopMissingCurrencyBody,
  shopNumericIdBody,
} from '../../test-support/fixtures/shop-info.js';

const operations = [SHOP_INFO_OPERATION, GRANTED_SCOPES_OPERATION, LOCATIONS_OPERATION];

describe('operation documents', () => {
  it('selects the VS7-checked fields', () => {
    expect(SHOP_INFO_OPERATION.query).toContain(
      'shop { id name myshopifyDomain currencyCode plan { publicDisplayName partnerDevelopment shopifyPlus } }',
    );
    expect(GRANTED_SCOPES_OPERATION.query).toContain(
      'currentAppInstallation { accessScopes { handle } }',
    );
    expect(LOCATIONS_OPERATION.query).toContain('nodes { id name isActive fulfillsOnlineOrders }');
    expect(LOCATIONS_OPERATION.query).toContain('pageInfo { hasNextPage endCursor }');
  });

  it('never selects the deprecated plan displayName', () => {
    expect(SHOP_INFO_OPERATION.query).not.toMatch(/(?<!public)DisplayName|\bdisplayName\b/);
  });

  it('pages locations by 50 without inactive locations', () => {
    expect(LOCATIONS_OPERATION.query).toContain('first: 50');
    expect(LOCATIONS_OPERATION.query).toContain('includeInactive: false');
  });

  it('declares costs of about 2, 2 and 52, each below 1000', () => {
    expect(operations.map((o) => o.estimatedCost)).toEqual([2, 2, 52]);
    for (const o of operations) expect(o.estimatedCost).toBeLessThan(1000);
  });

  it('contains no API version literal', () => {
    for (const o of operations) expect(o.query).not.toMatch(/\b20\d\d-\d\d\b/);
  });
});

describe('response schemas parse the fixtures (VS8)', () => {
  it('parses a healthy shop', () => {
    expect(shopInfoSchema.safeParse(healthyShopBody.data).success).toBe(true);
  });

  it('rejects a shop without currencyCode and a numeric id', () => {
    expect(shopInfoSchema.safeParse(shopMissingCurrencyBody.data).success).toBe(false);
    expect(shopInfoSchema.safeParse(shopNumericIdBody.data).success).toBe(false);
  });

  it('parses scopes with a duplicate', () => {
    const parsed = grantedScopesSchema.parse(grantedScopesBody.data);
    expect(parsed.currentAppInstallation.accessScopes).toHaveLength(3);
  });

  it('parses empty nodes', () => {
    expect(locationsPageSchema.parse(emptyLocationsBody.data).locations.nodes).toEqual([]);
    expect(locationsPageSchema.safeParse(threeActiveBody.data).success).toBe(true);
  });

  it('parses multi-page cursors, with a null endCursor on the last page', () => {
    const pages = locations251Pages.map((p) => locationsPageSchema.parse(p.data).locations);
    expect(pages).toHaveLength(6);
    expect(pages.slice(0, 5).every((p) => p.pageInfo.hasNextPage && p.pageInfo.endCursor)).toBe(
      true,
    );
    expect(pages[5]?.pageInfo).toEqual({ hasNextPage: false, endCursor: null });
  });
});
