import { describe } from 'vitest';
import { parseShopDomain } from '../../domain/shop-domain.js';
import {
  FAILURE_SCRIPTS,
  HEALTHY_SCRIPT,
  THROTTLED_ONCE_SCRIPT,
  runGatewayContractSuite,
  type ContractAdapter,
  type FailureKind,
} from '../../test-support/gateway-contract-suite.js';
import { threeActiveBody } from '../../test-support/fixtures/locations.js';
import { grantedScopesBody } from '../../test-support/fixtures/granted-scopes.js';
import { healthyShopBody } from '../../test-support/fixtures/shop-info.js';
import { gatewayOver } from '../../test-support/gateway-test-helpers.js';
import { createHttpShopifyGateway } from './http-shopify-gateway.js';
import { createShopifyGraphqlClient } from './shopify-graphql-client.js';
import {
  SimulatedShopifyGateway,
  type SimulatedShop,
} from '../simulator/simulated-shopify-gateway.js';

const domain = (host: string) => {
  const parsed = parseShopDomain(host);
  if (!parsed.ok) throw new Error('fixture domain must parse');
  return parsed.domain;
};
const HEALTHY_SHOP: SimulatedShop = {
  id: healthyShopBody.data.shop.id,
  name: 'My Store',
  currencyCode: 'USD',
  planName: 'Basic',
  shopifyPlus: false,
  partnerDevelopment: false,
  scopes: ['write_products', 'read_locations'],
  locations: threeActiveBody.data.locations.nodes,
};
const simulator = (shops: Record<string, SimulatedShop>) => {
  const gateway = new SimulatedShopifyGateway();
  for (const [host, shop] of Object.entries(shops)) gateway.addShop(domain(host), shop);
  return gateway;
};

const simulatorAdapter: ContractAdapter = {
  retriesInternally: false,
  healthy: () => simulator({ 'mystore.myshopify.com': HEALTHY_SHOP }),
  failing: (kind: FailureKind) => {
    const gateway = simulator({ 'mystore.myshopify.com': HEALTHY_SHOP });
    gateway.faults.always('getShopInfo', { kind });
    return gateway;
  },
  throttledOnce: () => {
    const gateway = simulator({ 'mystore.myshopify.com': HEALTHY_SHOP });
    gateway.faults.on('getShopInfo', 1, { kind: 'THROTTLED' });
    return gateway;
  },
  twoStores: () =>
    simulator({
      'alpha.myshopify.com': { ...HEALTHY_SHOP, name: 'Alpha Store' },
      'beta.myshopify.com': { ...HEALTHY_SHOP, name: 'Beta Store' },
    }),
};

/** Answers by host and operation, so two stores can run concurrently in any order. */
const routedFetch = (names: Record<string, string>) => {
  const answer = (url: string, query: string): unknown => {
    const host = new URL(url).host;
    if (query.includes('ShopInfo')) {
      const shop = { ...healthyShopBody.data.shop, name: names[host], myshopifyDomain: host };
      return { data: { shop } };
    }
    return query.includes('GrantedScopes') ? grantedScopesBody : threeActiveBody;
  };
  return (url: string, init: RequestInit = {}): Promise<Response> =>
    Promise.resolve(
      new Response(
        JSON.stringify(answer(url, (JSON.parse(init.body as string) as { query: string }).query)),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
};

const httpAdapter: ContractAdapter = {
  retriesInternally: true,
  healthy: () => gatewayOver(HEALTHY_SCRIPT).gateway,
  failing: (kind) => gatewayOver(FAILURE_SCRIPTS[kind]).gateway,
  throttledOnce: () => gatewayOver(THROTTLED_ONCE_SCRIPT).gateway,
  twoStores: () =>
    createHttpShopifyGateway(
      createShopifyGraphqlClient({
        fetchFn: routedFetch({
          'alpha.myshopify.com': 'Alpha Store',
          'beta.myshopify.com': 'Beta Store',
        }),
        timeoutSignal: () => new AbortController().signal,
        sleep: () => Promise.resolve(),
        random: () => 0,
      }),
    ),
};

describe('gateway contract suite', () => {
  runGatewayContractSuite('simulator', simulatorAdapter);
  runGatewayContractSuite('http adapter with scripted fetch', httpAdapter);
});
