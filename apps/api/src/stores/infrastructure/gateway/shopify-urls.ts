import { API_VERSION_PATTERN } from '../../../config/env.schema.js';
import { parseShopDomain, type ShopDomain } from '../../domain/shop-domain.js';
import { issueShopifyRequest, type ShopifyRequest } from './shopify-request.js';

/** Re-checks the brand at run time: the value must still parse to itself. */
const checkedHost = (domain: ShopDomain): string => {
  const parsed = parseShopDomain(domain);
  if (!parsed.ok || parsed.domain !== domain) throw new TypeError('Invalid shop domain.');
  return parsed.domain;
};

/** The only place an outbound URL is built: fixed scheme and paths, no port, userinfo or query. */
export const shopifyUrls = {
  graphql(domain: ShopDomain, version: string): ShopifyRequest {
    const host = checkedHost(domain);
    if (!API_VERSION_PATTERN.test(version)) throw new TypeError('Invalid API version.');
    return issueShopifyRequest(`https://${host}/admin/api/${version}/graphql.json`);
  },
  token(domain: ShopDomain): ShopifyRequest {
    return issueShopifyRequest(`https://${checkedHost(domain)}/admin/oauth/access_token`);
  },
};
