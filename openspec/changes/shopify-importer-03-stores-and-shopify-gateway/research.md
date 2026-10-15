---
schema: gentle-ai.sdd-research/v1
change: shopify-importer-03-stores-and-shopify-gateway
revision: 2
outcome: done
supersedes: revision 1
accessed_at: 2026-10-14
---

# Research: shopify-importer-03-stores-and-shopify-gateway (S2)

## Admission

| class | tool | observed | result |
|---|---|---|---|
| documentation | WebFetch | shopify.dev pages (versioning, rate limits, client credentials, access scopes, authorization code grant, offline tokens, distribution, Admin GraphQL reference pages, response codes, changelog) | admitted |
| open-web | WebSearch, WebFetch | community.shopify.dev threads, search result summaries, third-party guides | admitted (low authority) |

Method caveat: WebFetch and WebSearch return model-generated readings, so all excerpts are paraphrases except text in double quotes. Several pages were 404 or truncated (noted per item). Search-result summaries (WebSearch) were not page reads and are marked as such.

## Questions

- Q-R1. API version in response header or body; behaviour for unsupported or unreleased version.
- Q-R2. Store handle grammar and maximum length; renamed-store redirects.
- Q-R3. ACCESS_DENIED response shape for missing scope; HTTP status and body for invalid or revoked token.
- Q-R4. THROTTLED versus 429 and Retry-After; bucket and restore rate per plan; single-query cost limit.
- Q-R5. Client credentials grant errors, token format, response fields, revocation, token endpoint rate limits.
- Q-R6. Scopes for stagedUploadsCreate, fileCreate and file queries; whether write implies read.
- Q-R7. Loopback redirect URIs on Dev Dashboard apps; non-expiring offline tokens for custom apps.
- Q-R8. locations query limits and scope behaviour; field names for plan, currency and access scopes.
- Q-R9. End-of-life policy for legacy custom app tokens (shpat_).

## Sources

Grouped sources list every URL read. Docs class means shopify.dev, publisher Shopify.

| ID | class | title | publisher | URL | excerpt |
|---|---|---|---|---|---|
| S1 | documentation | API versioning | Shopify | https://shopify.dev/docs/api/usage/versioning | "API responses include the X-Shopify-API-Version header reflecting the version used to fulfill the request." "If your app targets an inaccessible version, Shopify falls forward and responds using the oldest accessible stable version." Header differing from requested means inaccessible version. Table: 2026-10 released Oct 1 2026 (latest stable); 2026-07, 2026-04 stable; 2027-01 release candidate. Unreleased or malformed version handling, status and body not described. |
| S2 | documentation | GraphQL Admin rate limits (reached via link) | Shopify | https://shopify.dev/docs/apps/build/apis/graphql-admin/rate-limits | Per plan points/second: Standard 100, Advanced Shopify 200, Shopify Plus 1000, Shopify for enterprise (Commerce Components) 2000. "A single query may not exceed a cost of 1,000 points, regardless of plan limits." Bucket size and restore rate "based on the store's plan" but not stated separately. Only status mentioned: 429 Too Many Requests for a daily throttle on product and variant creation. THROTTLED shape and Retry-After not covered. |
| S3 | documentation | GraphQL Admin API reference overview and general rate limits page | Shopify | https://shopify.dev/docs/api/admin-graphql/latest ; https://shopify.dev/docs/api/usage/rate-limits | Overview: sample extensions show maximumAvailable 1000.0 and restoreRate 50.0 (illustrative, not plan-specific). Sample error "Query cost is 2003, which exceeds the single query max cost limit (1000)" (code MAX_COST_EXCEEDED). ACCESS_DENIED described as "The client doesn't have correct authentication credentials. Similar to 401 Unauthorized." THROTTLED: "The client has exceeded the rate limit. Similar to 429 Too Many Requests." Documented HTTP codes 400, 402, 403, 404, 423 and 5xx; 429 and Retry-After not documented there. General rate-limits page: gives no GraphQL numbers; recommended backoff one second; no 429 or Retry-After mention. |
| S4 | documentation | Response codes (API usage) | Shopify | https://shopify.dev/docs/api/usage/response-codes | Missing scope returns "200 OK with ACCESS_DENIED in errors[n].extensions.code" (no JSON example, no requiredAccess mention). 401: credentials "aren't present in the request or are incorrect"; expired token returns it; no body example. For GraphQL Admin, Storefront, Customer Account and Payments Apps APIs, rate limiting returns 200 OK with THROTTLED error (example message "Throttled", extensions code "THROTTLED"). Partner API returns 429. Refresh-token error: code invalid_request, "This request requires an active refresh_token." |
| S5 | documentation | Client credentials grant | Shopify | https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant | POST to https://{SHOP}.myshopify.com/admin/oauth/access_token, form-encoded, grant_type=client_credentials, client_id, client_secret. Response fields documented: access_token, scope, expires_in ("always 86399", 24 hours). shop_not_permitted message: "Oauth error shop_not_permitted: Client credentials cannot be performed on this shop." (cause: app and store not in same organization). Wrong secret, status codes, token prefix, revocation and token-endpoint rate limits not documented. Sending client_id or client_secret to the GraphQL Admin API gives "Invalid API key or access token" (status not given). |
| S6 | documentation | Admin GraphQL reference pages: fileCreate, files query, stagedUploadsCreate, locations, location, Shop, ShopPlan, AppInstallation | Shopify | https://shopify.dev/docs/api/admin-graphql/latest/mutations/fileCreate ; https://shopify.dev/docs/api/admin-graphql/latest/queries/files ; https://shopify.dev/docs/api/admin-graphql/latest/mutations/stagedUploadsCreate ; https://shopify.dev/docs/api/admin-graphql/latest/queries/locations ; https://shopify.dev/docs/api/admin-graphql/latest/queries/location ; https://shopify.dev/docs/api/admin-graphql/latest/objects/Shop ; https://shopify.dev/docs/api/admin-graphql/latest/objects/ShopPlan ; https://shopify.dev/docs/api/admin-graphql/latest/objects/AppInstallation | fileCreate: "Requires write_files access scope, write_themes access scope or write_images access scope." files query: "Requires read_files access scope, read_themes access scope or read_images access scope." stagedUploadsCreate: no scope text on page. locations: args after, before, first, includeInactive (default false), includeLegacy (default false), last, query, reverse (default false), sortKey (default NAME); no max first, default page size or scope stated. location: no scope text. Shop: plan ShopPlan!, currencyCode CurrencyCode!, myshopifyDomain String! (Shop page read only to char 100000 of 116565; the version is "latest", not confirmed as 2026-10). ShopPlan: publicDisplayName String!, partnerDevelopment, shopifyPlus, displayName (deprecated). AppInstallation: accessScopes [AccessScope!]!; query currentAppInstallation returns the AppInstallation for the authenticated app. File object and AppInstallation-related queries for file status page: File object URL returned 404. |
| S7 | documentation | Auth and distribution docs and changelog: manage access scopes, authorization code grant, offline access tokens, expiring-offline-token changelog, app distribution | Shopify | https://shopify.dev/docs/apps/build/authentication-authorization/manage-access-scopes ; https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant ; https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens ; https://shopify.dev/changelog/expiring-offline-access-tokens-required-for-all-public-apps-as-of-january-1-2027 ; https://shopify.dev/docs/apps/launch/distribution | "A write scope includes read." (write_products grants read_products). Authorization code grant: redirect URI "Must exactly match a redirect URI you've configured in the Dev Dashboard or your app's configuration TOML file"; no statement on localhost or 127.0.0.1 (page read to char 100000 of 138374). "New public apps must use expiring offline access tokens for GraphQL Admin API requests"; example access token 3600 s, refresh token 7,776,000 s. Offline tokens page: restriction on non-expiring tokens "doesn't apply to custom apps or apps created by merchants"; it does not state explicitly that custom apps can obtain non-expiring tokens. Changelog: from Jan 1 2027 public apps using non-expiring tokens get authentication errors; custom apps and merchant-created apps (Dev Dashboard or admin) listed as unaffected. Distribution: Shopify admin model "no longer available for new apps"; "Can't be created anymore, though existing apps keep working"; pre-generated Admin API access token; no sunset date. |
| S8 | open-web | Shopify Developer Community threads and search summaries | Shopify Developer Community (community.shopify.dev) and third parties | https://community.shopify.dev/t/starting-january-1-2026-you-will-not-be-able-to-create-new-legacy-custom-apps-this-will-not-impact-any-existing-apps/26798 ; https://community.shopify.dev/t/question-about-using-localhost-redirect-urls-for-shopify-oauth/32946 ; https://community.shopify.dev/t/access-denied-error-even-if-i-have-the-required-scope/34833 ; WebSearch summaries (legacy custom apps, store URL rename, handle rules) | Legacy thread title: "will not impact any existing apps"; page does not mention shpat_ or sunset; reply by "TerenceShopify" (Jan 9 2026) not confirmed as staff by the page. Localhost thread (w_higaki, Apr 3 2026): user set a 127.0.0.1 redirect URL and read the code from the address bar; no confirming answer. ACCESS_DENIED thread: example error with data null, message "Access denied for customer field. Required access: customer_read_customers access scope.", path ["customer"], extensions code ACCESS_DENIED, a docs link, and requiredAccess; this is the Customer Account API (customer_read_customers scope), not the Admin API, and the poster and replier are not confirmed staff (community). Search summaries (not page reads): third-party guides say old myshopify URL redirects after a one-time change; an npm validator uses 4 to 60 characters; neither official. |

## Validated claims

C1. Shopify API responses include the X-Shopify-API-Version header with the version used to fulfil the request (the page does not single out the Admin API but it is a versioned API). [S1]
C2. For an inaccessible (retired) version Shopify falls forward to the oldest accessible stable version; a differing header value signals this. Exact status and body: not documented. [S1]
C3. 2026-10 is the latest stable version (released Oct 1 2026); 2027-01 is a release candidate. [S1]
C4. Per-plan GraphQL Admin limits are stated as points/second: Standard 100, Advanced 200, Plus 1000, enterprise (Commerce Components) 2000; a single query may not exceed 1,000 points regardless of plan. [S2]
C5. Cost-exceeded queries return an error with sample message "Query cost is 2003, which exceeds the single query max cost limit (1000)" (code MAX_COST_EXCEEDED). [S3]
C6. For the GraphQL Admin API, rate limiting returns HTTP 200 OK with a THROTTLED error (example message "Throttled", extensions code THROTTLED), not HTTP 429. [S4]
C7. The only 429 documented for the Admin GraphQL context is a daily throttle on product and variant creation. Retry-After is not mentioned on any page read. [S2, S3, S4]
C8. A missing scope returns HTTP 200 with ACCESS_DENIED in errors[n].extensions.code. [S4]
C9. Invalid, absent or expired credentials give HTTP 401 per the response-codes page; no body example. [S4]
C10. Client credentials grant request is a form-encoded POST to the shop admin/oauth/access_token endpoint; response documents access_token, scope, expires_in (always 86399). [S5]
C11. The shop_not_permitted error message text is "Oauth error shop_not_permitted: Client credentials cannot be performed on this shop." and is caused by app and store being in different organizations. [S5]
C12. fileCreate requires write_files, write_themes or write_images (any one). [S6]
C13. The files query requires read_files, read_themes or read_images (any one). [S6]
C14. Documentation states "A write scope includes read." with write_products granting read_products. [S7]
C15. locations query arguments and defaults for includeInactive, includeLegacy, reverse, sortKey are as listed in S6. [S6]
C16. shop.plan is ShopPlan! with publicDisplayName String!; shop.currencyCode is CurrencyCode!; AppInstallation.accessScopes is [AccessScope!]!, reachable via the currentAppInstallation query. [S6]
C17. Redirect URIs must exactly match one configured in the Dev Dashboard or TOML. [S7]
C18. Non-expiring offline-token restriction applies to public apps; custom apps and merchant-created apps (Dev Dashboard or admin) are listed as unaffected. [S7]
C19. Legacy "Shopify admin" distribution apps cannot be created anymore, "though existing apps keep working", and use a pre-generated Admin API access token; no sunset date is given. [S7]
C20. Community (not official, staff status unconfirmed): thread title says the Jan 1 2026 change "will not impact any existing apps". [S8]
C21. Community example of an ACCESS_DENIED error with path ["customer"] and extensions.requiredAccess exists, but for the Customer Account API, so it is not evidence for the Admin API shape. [S8]

## Contradictions

- S2 states plan limits only as points/second per plan and says bucket size and restore rate are plan-based without separating them; S3's sample shows maximumAvailable 1000 and restoreRate 50 (Plus-like illustration). These are not reconciled; do not treat the sample as a Standard-plan value.
- S2 mentions 429 for a daily product and variant creation throttle, while S4 states GraphQL Admin throttling is 200 with THROTTLED. Probably different mechanisms, but the docs do not say so.
- S3 describes ACCESS_DENIED as "Similar to 401 Unauthorized" while S4 says a missing scope returns 200 OK with ACCESS_DENIED and credential failures return 401.
- Third-party search summaries disagree with each other about whether the old myshopify URL redirects after a rename; none is official.

## Unanswered or not documented

- Q-R1: status and body for an unreleased or malformed version: not documented on the versioning page; no body or status for fall-forward either. Tried: versioning page only.
- Q-R2: handle grammar, maximum length, uppercase and underscore rules, rename redirect (status and target): unanswered from official sources. Tried: help.shopify.com store-name page (wrong content, 404-equivalent for topic), web searches (only third-party summaries, including an unofficial 4 to 60 character validator).
- Q-R3: Admin API ACCESS_DENIED JSON (requiredAccess, path) and 401 body: not documented for the Admin API. Tried: response-codes page, API overview, community thread (Customer Account API only), changelog URL for access-scope messages returned 404. A search summary of that changelog (not a page read) says messages name the field and required scope with extensions containing code, docs link and the scope name; key name not confirmed.
- Q-R4: separate bucket size versus restore rate per plan, THROTTLED JSON body, Retry-After: not documented. Only points/second per plan available.
- Q-R5: HTTP status and body for shop_not_permitted and wrong secret, token prefix, extra response fields, revocation, token endpoint rate limits: not documented. Tried: client credentials grant page.
- Q-R6: scope required by stagedUploadsCreate: not documented on the mutation page (and the queries URL returned 404). Whether file status queries require read_files when only write_products is granted: files query lists read_files, read_themes or read_images only; File object page returned 404, so the file(s) status query behaviour by product scope is unvalidated. Whether write_files implies read_files falls under the general rule C14 but was not shown for files, inventory or locations specifically.
- Q-R7: whether Dev Dashboard accepts http://127.0.0.1:port or http://localhost:port redirects: not documented officially; only a community anecdote without confirmed answer. Whether custom-distribution apps can obtain non-expiring offline tokens: docs only say the expiring requirement does not apply to custom apps; not stated explicitly.
- Q-R8: locations maximum first, default page size, partial versus whole-query ACCESS_DENIED without location scopes: not documented; required scope for locations not stated. Field names verified on "latest" pages, not pinned to 2026-10.
- Q-R9: an official end-of-life date or statement that tokens stop working: none found. Official docs only say existing apps keep working and no sunset date is given.

## Uncertainty and freshness

- All reads on 2026-10-14; reference pages are "latest", presumed 2026-10 per S1 but not verified per page.
- Truncated reads: Shop object (116565 chars, read 100000) and authorization code grant page (138374 chars, read 100000).
- Search summaries were not verified against pages; statements about staff replies on legacy apps came from WebSearch summaries and are community-level evidence.
- Overall confidence: high for C1 to C4, C6, C8, C10 to C14, C16, C19; low for anything from S8.

## Implications for the design

Proposals, not validated claims:
- Read the X-Shopify-API-Version header on every response and treat a mismatch with the requested version as a hard fail-forward warning.
- Treat handle validation as unspecified: normalise to lowercase, restrict to letters, digits and hyphens, and keep length checks loose; do not rely on redirects, and store the myshopifyDomain returned by the API as canonical.
- Handle errors in both layers: HTTP 401 for bad or expired token, and HTTP 200 with errors[].extensions.code ACCESS_DENIED or THROTTLED; parse defensively and tolerate absence of requiredAccess.
- Use a one-second backoff on THROTTLED and honour throttleStatus data from the response extensions cost block; cap query cost under 1,000 points.
- Request write_files together with write_products; verify granted scopes at connect time through currentAppInstallation.accessScopes, and probe file and locations queries rather than assuming scope coverage.
- Cache client-credentials tokens and refresh before the 24-hour expiry; treat all error bodies from the token endpoint as opaque strings and classify by status and message substring.
- Do not depend on loopback redirect URIs for Dev Dashboard apps; prefer client credentials or verify manually.
- Keep legacy shpat_ tokens as a supported but non-creatable option, with no assumed sunset.

## Rescope at revision 2 (decided by the user on 2026-10-14)

Revision 1 ended partial: most questions were answered only in part or are not documented, and no further documentation round can close them; only a real store can. The user decided to close research by rescoping. Every item listed under "Unanswered or not documented" above is moved out of research into the design (as marked, unverified assumptions with provenance-tagged fixtures) and into the live smoke test against a real development store (S7 by default). No claim in the Validated claims section depends on a deferred item.

Deferred items: Q-R1 (status and body for an unreleased or malformed version), Q-R2 (store handle grammar, length and rename redirects), Q-R3 (Admin API ACCESS_DENIED JSON and the 401 body), Q-R4 (bucket size and restore rate per plan, THROTTLED body, Retry-After), Q-R5 (client credentials error statuses and bodies, token format, revocation), Q-R6 (scope of stagedUploadsCreate and file status queries), Q-R7 (loopback redirect URIs, non-expiring tokens for custom apps), Q-R8 (locations page size and partial access behaviour, field names pinned to 2026-10), Q-R9 (end-of-life of legacy tokens).
