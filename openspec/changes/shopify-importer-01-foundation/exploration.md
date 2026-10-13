# Exploration: Shopify Catalog Importer MVP (roadmap) and foundation slice

> Orchestrator notes
>
> - Explored on 2026-10-13 under the working name `shopify-catalog-importer-mvp`. The user approved splitting the MVP into eight sequential changes (S0 to S7, section 5). This file lives in the first change, `shopify-importer-01-foundation`, and doubles as the roadmap for the later ones.
> - The exploration ran before the repository existed. Git is now initialized on `main` with `origin` at `github.com/sebahernandez/shopify-catalog-importer`, so the "not a git repository" risk is resolved.
> - The requirements source, `shopify-catalog-importer-prompt.md`, is intentionally untracked (listed in `.gitignore`). It exists only on the operator's machine.
> - A condensed recovery copy is in Engram: topic key `sdd/shopify-catalog-importer-mvp/explore`, observation 183.

Legend: **[V]** means the explorer read it on shopify.dev or the cited source on 2026-10-13. **[U]** means it could not be confirmed. The fetch tool summarizes pages, so signatures marked [V] come from those summaries and must be re-checked against the schema during design.

## Current state

Greenfield. No application code, no `package.json`, no tests, so `strict_tdd` is false. All findings concern requirements and external APIs.

## 1. Requirements map

### Capability areas

| # | Capability | Core requirements |
|---|---|---|
| C1 | Store connections | Multi-store isolation. Fields: internal ID, display name, canonical domain, Shopify shop ID, API version, protected credentials, status, last check. Verification checks identity, currency, locations, and granted scopes against required scopes. Domain allowlist (SSRF guard). Auth behind an interface so OAuth can be added later. |
| C2 | Excel contract | Template with `Productos`, `Variantes`, `Imagenes` plus an optional instructions sheet. Text-typed SKU and barcode. Decimal-safe prices. No formulas, macros or external links. |
| C3 | Local images | Browser upload (multi-file or folder). Path normalization and traversal protection. Format, dimension, size and real-content validation. Missing, ambiguous, orphan and dangling reference detection. Content hash. Persistent originals. |
| C4 | Validation tiers | A local (no network, no writes), B remote (reads only), C execute. Report columns: sheet, row, product, field, severity, message, suggested action. Persisted immutable plan bound to store and input hashes. Re-check of conflicts before writing. |
| C5 | Import engine | Persistent per-product state machine, backend worker, bounded concurrency, cost-aware throttling, backoff with jitter. Checks HTTP status, GraphQL errors, userErrors and async status. Products created as DRAFT. |
| C6 | Resume and reconciliation | Logical identity is `shop_id + import_namespace + product_key`. Ledger of batches, IDs, hashes and stages. One run per batch. Restart recovery. Timeout after a create means look up before retrying, else `NEEDS_RECONCILIATION`. Cancel means stop starting new work. |
| C7 | Spanish UI | 7 screens, always showing the selected store. Pre-execute summary. Execute disabled on blocking errors. Real progress. XLSX/CSV results with formula-injection protection. |
| C8 | Security and operations | Loopback binding, strict CORS, CSRF/origin protection on write endpoints, no secrets or signed URLs in logs, HTML sanitization, upload limits, retention docs. |
| C9 | Demo and tests | Simulated adapter and an explicit DEMO banner. Fixtures. Opt-in real-store tests. A 16-item test matrix. |
| C10 | Deliverables | README, Shopify connection guide, data-format doc, recovery doc, operations and scopes list, limitations, migrations, `.env.example`. |

### Ambiguities, tensions and hidden decisions

1. **Credential acquisition is not literally "paste a token".** The document says to connect via "valid credentials of an authorized app". As of 2026-01-01, new legacy admin-created custom apps (with the `shpat_` token) cannot be created; existing ones keep working [V]. The replacement is a Dev Dashboard app plus the client credentials grant, which only works when the app and the store belong to the same Shopify organization, with 24-hour tokens [V]. Other stores need custom distribution plus the authorization code grant, an OAuth redirect flow [V]. The document defers OAuth and does not say which stores the operator will connect, so this is a blocking product question (D1).
2. **`handle` uniqueness vs. "never suffix".** A handle collision must be a conflict, with no suffix and no overwrite. The `productSet` `handle` field is generated from the title "with a suffix added if the handle is taken" when omitted [V]. What happens when a provided handle is taken is [U]. Design implication: preflight with `productByIdentifier(handle)` in tier B and again just before the write. A race window remains and is a documented limitation.
3. **Exactly-once vs. duplicate prevention.** Shopify's `@idempotent` directive covers 17 inventory, refund and location mutations; `productCreate` and `productSet` are not in that list [V]. Creation is not idempotent. Prevention relies on a persisted attempt record, a lookup before retry, and optionally a unique-value metafield.
4. **Barcodes.** The document uses a single `codigo_barras` column. The latest API version marks `barcode` as deprecated in favor of `barcodes[]` (up to 20 per variant) [V]. Default: one barcode per variant.
5. **Image reuse across products.** Recommended default: dedup by content hash only within the same product and same store, never across products. Alt text is per usage.
6. **"All validation local" vs. location and SKU checks.** Location names can only be resolved in tier B; tier A can only check that the name is non-empty and consistent. Currency is also only known after verification.
7. **Ambiguous decimals.** Default: `.` as the decimal separator, optional thousands `,` only if unambiguous; reject `1,234` as ambiguous and require plain `1234.50`. Must be documented.
8. **Granted permissions.** Use `currentAppInstallation { accessScopes { handle } }`. The page states no required scope for it [V].
9. **Whole-file XLSX reading.** Zip-bomb and size limits are needed; the document is silent on them.
10. **Excel edge cases.** Technical defaults: comma-delimited `etiquetas`, status always DRAFT, never gift card.

### Decisions with a reasonable technical default

Decimal handling as text, pnpm workspace layout, SQLite job-table worker, AES-256-GCM key file location, concurrency default of 2, image formats JPEG/PNG/WebP, status DRAFT only, comma-delimited tags.

## 2. Shopify Admin GraphQL (checked 2026-10-13)

### Supported versions and which to pin

- Source: https://shopify.dev/docs/api/usage/versioning [V]
- Stable: 2026-01 (until Jan 16 2027), 2026-04 (until Apr 16 2027), 2026-07 (until Jul 16 2027), 2026-10 (latest, released Oct 1 2026, until Oct 16 2027). 2025-10 and earlier are unsupported. 2027-01 is a release candidate. Each stable version is supported for at least 12 months.
- **Recommendation: pin `2026-07`.** `barcode` is still non-deprecated there; on 2026-10 it is deprecated in favor of `barcodes` [V, per-version pages for `ProductVariantsBulkInput`]. Make the version a single config value. Alternative: pin 2026-10 for the longest support window at the cost of the barcode change (D2).
- Gotcha: the `latest` docs path resolves to 2026-10. Always verify signatures against `/admin-graphql/2026-07/`.

### How a locally run app gets credentials

- https://shopify.dev/docs/apps/build/dev-dashboard/get-api-access-tokens [V]: `POST https://{shop}.myshopify.com/admin/oauth/access_token` with form body `grant_type=client_credentials`, `client_id`, `client_secret`. Token lasts 24 hours (`expires_in` 86399). The returned `scope` mirrors the scopes configured on the app version, not scopes requested in the call. Works only when app and store are in the same organization; otherwise "Client credentials cannot be performed on this shop." Other stores: custom distribution, token exchange, or authorization code grant.
- https://community.shopify.dev/t/starting-january-1-2026-you-will-not-be-able-to-create-new-legacy-custom-apps-this-will-not-impact-any-existing-apps/26798 [V]: no new legacy custom apps from 2026-01-01; existing apps unaffected. The official end-of-life policy for existing legacy tokens was not found [U].
- Granted scopes: `currentAppInstallation { accessScopes { handle } }` [V], https://shopify.dev/docs/api/admin-graphql/latest/queries/currentAppInstallation
- Design consequence for C1: the credential port must support (a) a static token (legacy app) and (b) client credentials with a refresh cycle (cache the token in memory, refresh before expiry, store `client_id` and `client_secret` encrypted, never the token). OAuth stays a later adapter.

### Product creation

- `productSet` [V], https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/productSet
  - Create-or-update. `synchronous` defaults to true; with `false` it returns a `ProductSetOperation` polled via `productOperation`.
  - `identifier` takes `id`, `handle` or `customId`. Omitting it creates a product. Scope: `write_products`.
  - `ProductSetInput`: `title`, `handle`, `descriptionHtml`, `vendor`, `productType`, `tags`, `status`, `metafields`, `productOptions` (max 3), `variants`, `files`.
  - `ProductVariantSetInput`: `optionValues` (required), `sku`, `barcode`, `price`, `compareAtPrice`, `inventoryItem`, `inventoryQuantities` (per location; total across variants in one call must not exceed 50,000), and `file` (must also be in the product `files`).
  - **List semantics are destructive:** omitted list entries (variants, metafields) are deleted. Never re-send a partial list to a product that already has data from this import.
- Multi-step alternative [V]
  - `productCreate` creates the product with only its initial variant; more variants need `productVariantsBulkCreate`. https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/productCreate. The default status is not stated on that page.
  - `productVariantsBulkCreate` `strategy`: `DEFAULT` (deletes the standalone "Default Title" variant if it is the only one), `PRESERVE_STANDALONE_VARIANT`, `REMOVE_STANDALONE_VARIANT`. https://shopify.dev/docs/api/admin-graphql/2026-07/enums/ProductVariantsBulkCreateStrategy
  - `productOptionsCreate` `variantStrategy`: `LEAVE_AS_IS` (default) or `CREATE`. Max 3 options; max 2048 variants with `CREATE`.
- `ProductStatus`: `ACTIVE`, `ARCHIVED`, `DRAFT`, `UNLISTED` [V]. https://shopify.dev/docs/api/admin-graphql/2026-07/enums/ProductStatus
- Default initial variant: for a simple product via `productSet`, send one option "Title" / value "Default Title" and one variant [U, no worked example confirmed; needs a spike]. Multi-step path: `productVariantsBulkCreate` with `REMOVE_STANDALONE_VARIANT`.
- **Recommendation:** `productSet` as the primary creation path, since one mutation carries options, variants, price, SKU, barcode, tracked flag, per-location quantities, files, the variant-file link and metafields. Keep per-stage state for media upload, creation, media readiness and verification. The multi-step path is the fallback. Final call belongs to design.

### Media flow

- `stagedUploadsCreate` [V], https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/stagedUploadsCreate. Input list of `{filename, mimeType, httpMethod, resource, fileSize}`. Use `resource: IMAGE`; `PRODUCT_IMAGE` is deprecated. Returns `stagedTargets { url, resourceUrl, parameters }`. The product-media guide says images use PUT while the mutation page examples use POST: which `httpMethod` is right for images is [U]; implement per the returned parameters and confirm in a spike. Target expiry and scope are [U].
- `fileCreate` [V], https://shopify.dev/docs/api/admin-graphql/2026-07/mutations/fileCreate. Up to 250 files per call. `originalSource` can be a staged `resourceUrl`. Alt over 512 characters errors. Scope: one of `write_files`, `write_themes`, `write_images`. Status via `fileStatus`: `UPLOADED`, `PROCESSING`, `READY`, `FAILED`.
- `productSet` `files` accepts `originalSource`, `alt`, `filename`, `contentType`, `duplicateResolutionMode` (default `APPEND_UUID`) [V].
- Recommended order: staged upload, `fileCreate`, poll to `READY` (so a processing failure is known before the product exists), then reference the file ID in `productSet.files` and `variants.file`.
- Variants: `productVariantAppendMedia(productId, variantMedia: [{variantId, mediaIds}])` [V]. The media must already belong to the product.
- Reorder: `productReorderMedia(id, moves: [{id, newPosition}])` returns a `Job`; position 0 is the primary image [V]. No separate "featured media" mutation was found [U]; ordering is asynchronous and must be verified by reading the media back.
- Image limits [V, https://shopify.dev/docs/apps/build/online-store/product-media]: PNG, GIF, JPEG, WEBP, HEIC; max 20 MB; max 4472x4472 px (20 MP); recommended 2048x2048; aspect ratio between 100:1 and 1:100.

### Inventory

- Tracking: `inventoryItem.tracked` on `InventoryItemInput` [V]. `gestionar_inventario=false` maps to not setting tracked or quantities.
- Locations: `locations(first, includeInactive=false, includeLegacy=false, query)` [V]. Required scope [U] (expected `read_locations`).
- Activation: `inventoryActivate(inventoryItemId, locationId, available, onHand)`, `@idempotent` required since 2026-04, scope `write_inventory` [V]. Behavior when already active [U].
- Quantities: `productSet` variant `inventoryQuantities` (`locationId`, `name` in `available|on_hand`, `quantity`) [V], or `inventorySetQuantities` [V] with `name` (required), `reason` (required), optional `referenceDocumentUri`, and `quantities[{inventoryItemId, locationId, quantity, changeFromQuantity}]`. `changeFromQuantity` must be passed but may be `null`. There is no `compareQuantity` or `ignoreCompareQuantity` on 2026-07; do not copy older examples. `@idempotent(key: ...)` required from 2026-04. Scope `write_inventory`.
- Idempotency [V], https://shopify.dev/docs/apps/build/apis/graphql-admin/implementing-idempotency: keys last 24 hours; persist the key before sending; reuse on retry of the same input; different input with the same key returns `IDEMPOTENCY_KEY_PARAMETER_MISMATCH`. A community report of reused keys executing three times on 2026-04 is unresolved [U]; do not rely on the dedupe alone.
- Recommendation: `productSet.inventoryQuantities` as primary for new products; if a separate stage is preferred, `inventorySetQuantities` with a deterministic key (UUID v5 of batch + product + item + location).

### Lookups, conflict detection, uniqueness

- By handle: `productByIdentifier(identifier: {handle})`, scope `read_products` [V]. https://shopify.dev/docs/api/admin-graphql/2026-07/queries/productByIdentifier
- By custom ID: `productByIdentifier(identifier: {customId: {namespace, key, value}})` and `productSet(identifier: {customId})`, which upserts [V]. https://shopify.dev/docs/apps/build/custom-data/metafields/working-with-custom-ids
- Genuinely unique option: metafield definition `capabilities.uniqueValues.enabled: true` [V], https://shopify.dev/docs/apps/build/metafields/use-metafield-capabilities. Supported types: single-line text, URL, integer, and `id`. It can only be enabled on a definition without existing metafields. Behavior under concurrent writes and the scope needed to create the definition are [U]. An ordinary metafield gives no uniqueness guarantee.
- Trade-off: `customId` upsert makes a retry after a timeout unable to create a second product with the same ID (if uniqueness holds), at the cost of writing a metafield definition into the merchant's store, and a resumed `productSet` would update, and via list semantics possibly delete, rather than fail.
- **Recommendation:** defense in depth. (1) Persist an attempt record before every create. (2) On timeout or restart, look up by `customId` or by the stored product GID. (3) Use `uniqueValues` if the user accepts the store write (D4); otherwise rely on lookup plus `NEEDS_RECONCILIATION`.

### Rate limiting and input limits

- https://shopify.dev/docs/apps/build/apis/graphql-admin/rate-limits [V]. Restore rate by plan: Standard 100, Advanced 200, Plus 1000, enterprise 2000 points per second. `extensions.cost`: `requestedQueryCost`, `actualQueryCost`, `throttleStatus { maximumAvailable, currentlyAvailable, restoreRate }`. A single query cannot exceed 1000 points. The page does not mention a `THROTTLED` error code [U]; check both HTTP status and `errors[].extensions.code` against a live or recorded response.
- Array inputs: max 250 items per input array [V], https://shopify.dev/docs/api/usage/limits.
- Variant-creation daily throttle: conflicting documentation. The `productCreate` page says 1,000 new variants/day once a store reaches 50,000 variants; the limits pages say 10,000/day at 500,000 variants, not applicable to Plus [both V]. Unresolved; handle HTTP 429 and note it as a limitation.
- Backoff: Shopify recommends about 1 second [V]; the engine adds exponential backoff with jitter.

### Required scopes

- Products write: `write_products` [V]. Products read: `read_products` [V].
- Files: `write_files` (or `write_themes`/`write_images`) [V]. File status read [U], likely `read_files`.
- Inventory write: `write_inventory` [V]. Inventory read [U], expected `read_inventory`.
- Locations [U], expected `read_locations`.
- `shop { id name currencyCode myshopifyDomain }`: fields [V], scope [U].
- `currentAppInstallation`: no scope stated [V].
- Metafield definition with the unique capability [U].
- Build the scope list only from operations actually used and confirm each [U] against https://shopify.dev/docs/api/usage/access-scopes before shipping the guide.

## 3. XLSX library

| Candidate | Maintenance evidence | Formula detection | Text preservation | Template writing | Notes |
|---|---|---|---|---|---|
| **SheetJS CE** (`xlsx` 0.20.3 from cdn.sheetjs.com) | Docs call the CDN "the authoritative source"; npm `xlsx` is stuck at 0.18.5 [V, https://docs.sheetjs.com/docs/getting-started/installation/nodejs] | Cell objects expose the formula (`f`) vs value [U] | String cells kept as strings; raw option to avoid coercion [U] | Basic; CE lacks rich styling and data validation [U] | Install by tarball URL and vendor it |
| **ExcelJS** 4.4.0 | Last publish 2023-10-19 [V] | Formula cells exposed as `{formula, result}` [U] | Per-cell text format supported [U] | Strong: styles, data validation, protection | Widely used but stale, large dependency tree |
| **read-excel-file** 9.3.12 + **write-excel-file** 4.1.1 | Actively published [V] | **Fails the requirement:** unresolved formulas are "silently ignored and the cells will be interpreted as empty" [V, README] | Not documented [U] | Simple xlsx only | Cannot satisfy "reject formulas" |

**Recommendation:** SheetJS CE 0.20.3 (vendored tarball) for reading, with a spike in S1 that proves on fixtures: (1) formula cells are detected, (2) leading-zero SKUs and barcodes stay text, (3) macros and external links are rejected or ignored, (4) a generated template round-trips. If the CE template lacks needed formatting, generate it with `write-excel-file` and keep SheetJS for reading. Enforce an uncompressed-size cap and a ZIP entry cap before parsing, independent of the library.

## 4. Architecture

### Options

| Approach | Pros | Cons | Effort |
|---|---|---|---|
| **A. pnpm workspace: `apps/api` (NestJS), `apps/web` (React/Vite), `packages/contracts` (zod schemas and shared types)** | Physically enforces "no token in the frontend". Single source of truth for contracts. Matches the document and the screaming/hexagonal preference. Independent build and test per app. | More initial config. | Medium |
| B. Single package with `src/server` and `src/web` | Least setup. | Boundary by convention only; shared types leak; mixed toolchains. | Low now, high later |
| C. Monorepo with separate `packages/shopify-gateway`, `packages/import-engine` | Strongest isolation. | Over-engineering for an MVP. | High |

**Recommendation: A**, with the hexagonal boundary inside `apps/api` as modules, promoting to packages only if it earns it.

### Backend structure (screaming modules)

`apps/api/src/`: `stores`, `catalog-workbook`, `media`, `import-planning`, `import-engine`, `reporting`, `shared-kernel` (`Money`, ids, clock, logger with redaction).

Ports owned by the application layer, adapters in infrastructure:

- `CredentialProvider`: `StaticTokenCredentials`, `ClientCredentialsGrant`, later `OAuthCredentials`.
- `ShopifyGateway`: `getShopInfo`, `listLocations`, `getGrantedScopes`, `findProductByHandle`, `findProductByCustomId`, `stagedUpload`, `registerFile`, `getFileStatus`, `createProduct`, `reorderMedia`, `setInventory`. Adapters: `HttpShopifyGateway` and `SimulatedShopifyGateway` (in-memory plus injectable faults: throttle, timeout-after-create, file processing failure, 5xx).
- `ImportRepository` / `LedgerRepository` (Prisma/SQLite), `BlobStore` (local filesystem, content-addressed), `Clock`, `IdGenerator`, `SecretBox`.
- Pure domain functions: workbook validation rules, plan building, state transitions.

The simulated adapter serves demo mode, deterministic tests for the 16-item matrix, and contract tests the HTTP adapter must also satisfy (recorded fixtures; a real dev store only opt-in).

### Frontend

`apps/web/src`: `features/<screen>` (containers using hooks and the API client) and `ui/{atoms,molecules,organisms}` (presentational, Tailwind, accessible primitives). Seven screens map to seven feature folders. Spanish strings in one catalog. The demo banner is a global organism driven by connection mode.

### In-process persistent worker on SQLite

- A durable job table (`import_batch`, `import_product_task` with `state`, `attempt`, `lease_owner`, `lease_expires_at`, `idempotency_key`) is the queue. The worker is a Nest provider that polls with a lease and is the only writer of stage transitions.
- Bounded concurrency via an in-memory semaphore (default 2). One run per batch is enforced by a row-level lease in the DB.
- WAL mode, short transactions, `busy_timeout`. Each stage transition and the returned Shopify IDs are written in the same transaction.
- Restart recovery: on boot, find tasks with an expired lease or an in-flight stage, run the reconciliation lookup, then continue or mark `NEEDS_RECONCILIATION`.
- Intent record: persist `PRODUCT_CREATING` with the planned `customId` and an idempotency key before sending; persist the product GID after the response.

### Credential encryption at rest

- AES-256-GCM via Node `crypto`, random IV per secret, authenticated tag, key-version field for rotation.
- The 32-byte key lives outside the database: an env var or a `0600` key file whose path is in a gitignored `.env`, generated on first run. Losing the key makes credentials unrecoverable.
- Store only the client secret or static token; keep 24-hour access tokens in memory.
- Logger redaction for tokens, signed upload URLs and staged-upload `parameters`.

### Decimal-safe prices

- Prisma on SQLite maps `Decimal` to a `DECIMAL` column, which goes through numeric affinity [V for the mapping; the exactness conclusion is inferred and needs a test]. Avoid `Json` columns on SQLite [U]; store JSON as TEXT.
- **Decision:** store money as canonical decimal strings (`TEXT`), keep strings through the engine and the Shopify request, and use a decimal library (`decimal.js` or `big.js`, not version-checked [U]) only to parse, validate and compare. Validate scale against currency decimals after the tier-B currency lookup.

### Stack versions observed on npm (2026-10-13)

Prisma CLI `8.0.0-rc.22` is a prerelease; `@prisma/client` `7.10.0` is the stable line and is preferred. Sharp `0.35.5`. `@nestjs/core` was not checked [U]. Pin exact versions during scaffolding after checking compatibility.

## 5. Delivery slicing (approved by the user)

One change for the whole MVP is not workable against a 400-line review budget.

| # | Change | Scope | Depends on | Size signal | Independently verifiable by |
|---|---|---|---|---|---|
| S0 | **foundation** (`shopify-importer-01-foundation`) | pnpm workspace, tsconfig strict, lint/format, Nest and Vite skeletons, Prisma + SQLite + first migration, `.env.example`, config module (pinned API version, loopback host/port), logger with redaction, `SecretBox`, `Money` kernel, Vitest wiring, scripts, `/health` endpoint, loopback + origin guard | none | Large; 2 PRs: 0a repo + tooling, 0b api/web skeletons + persistence | Typecheck, lint, tests, app boots per README |
| S1 | **workbook-and-validation-core** | Template generation and download, XLSX reader (library spike), tier A validation, error report model, decimal parser | S0 | Large | Unit tests with Excel fixtures |
| S2 | **stores-and-shopify-gateway** | `CredentialProvider`, encrypted store records, domain allowlist, connection verification, `ShopifyGateway` port, simulated gateway, HTTP read-only calls, GraphQL client with cost tracking and error classification | S0 | Large | Gateway contract tests on the simulator; recorded-fixture HTTP tests |
| S3 | **local-images** | Upload endpoint, storage, path normalization, image validation (Sharp), hashing, reference resolution, orphan and ambiguity detection, preview | S0, S1 | Medium | Fixture images including corrupt and mismatched types |
| S4 | **plan-and-preview** | Tier B remote checks, immutable persisted plan bound to input hashes, preview data model, API for the UI | S1, S2, S3 | Medium | Plan immutability and invalidation tests |
| S5 | **import-engine** | State machine, worker, ledger, gateway write operations, throttling, backoff, reconciliation, cancel, restart recovery, simulated fault matrix | S2, S4 | Very large; 5a engine on the simulator, 5b HTTP write adapter | The 16-item test matrix against the simulator |
| S6 | **ui-and-reports** | Seven Spanish screens, progress, history, results XLSX/CSV with formula-injection protection, demo banner | S4, S5 | Large, split per screen group | Component tests; Playwright demo flow |
| S7 | **hardening-and-docs** | Opt-in real-store harness, security checklist, README, Shopify guide, data format, recovery, operations/scopes list, limitations, retention | all | Medium | Docs checks, final end-to-end demo run |

S1 and S2 can proceed in parallel after S0. Each slice's task forecast must be checked against 400 lines; S0, S1, S2, S5 and S6 will each need chained slices.

## 6. Risks

| Severity | Risk | Mitigation |
|---|---|---|
| High | Credential model (D1): client credentials only work within the same organization, and admin-created tokens can no longer be created. The operator may be unable to connect their stores with the simple flow. | Decide D1 before proposing S2. Support static tokens and client credentials behind one port; document the OAuth need. |
| High | No real store to verify against. Live behavior (`productSet` payloads, staged upload method, image processing, throttle responses, unique-value behavior under concurrency) stays unverified. | The simulated adapter and demo mode are the only verifiable path; say so in every report. Recorded fixtures plus an opt-in real-store suite. Never claim real-store verification. |
| High | Creation is not idempotent. Without `uniqueValues` the system can detect but not prevent duplicates after an ambiguous timeout. | Persist intent before mutation, look up by handle and custom ID, use `NEEDS_RECONCILIATION`; decide D4. |
| Medium | API surface changes between versions (barcode to barcodes, mandatory `@idempotent`, `changeFromQuantity`). | Pin 2026-07, keep a version-conformance fixture test, verify each signature against the pinned-version page. |
| Medium | `productSet` deletes omitted list items; a partial retry can remove data. | Resume logic never re-issues `productSet` against a created product. |
| Medium | Conflicting variant-throttle docs; unknown scopes for locations, files read, inventory read. | Confirm in S2 against the scopes page. |
| Medium | XLSX library trade-offs; zip bombs and large workbooks. | S1 spike; size and entry caps before parsing; vendor the tarball. |
| Medium | Items not deliverable literally: verifying every GraphQL operation (several remain [U]), "exactly once", a dedicated "featured media" operation, admin links (shop handle format unverified). | Document each as a limitation or tag `unverified-without-real-store`. |
| Low | Prisma 8 is an RC; Sharp is native; Json on SQLite uncertain. | Pin the stable line; store JSON as TEXT. |
| Resolved | Not a git repository. | Initialized on 2026-10-13 with `origin` configured. |

## Open product decisions

| ID | Decision | Options and consequences | Needed by | Status |
|---|---|---|---|---|
| D1 | Which stores are connected and how credentials are obtained | (1) Only stores in the operator's own organization: client credentials grant works, simplest, nothing outside the organization. (2) Stores with an existing legacy custom app token: static token works, no new ones can be created. (3) Arbitrary merchant stores: needs OAuth, larger S2. (4) Support 1 and 2 behind one port (recommended). | S2 | Pending |
| D2 | Pinned Admin API version | (1) `2026-07` (recommended; `barcode` not deprecated; supported to July 2027). (2) `2026-10` (longest support; `barcodes[]` shape from the start; newest behavior). One config value either way. | S0 | Pending |
| D3 | Delivery shape and repository | Split into S0 to S7 as separate chained changes, with git. | S0 | Confirmed by the user on 2026-10-13 |
| D4 | May the importer create a unique-value metafield definition in the merchant store | (1) Yes: stronger duplicate prevention, a visible permanent definition in the store, scope unconfirmed. (2) No: lookup only, more `NEEDS_RECONCILIATION` cases. | S5 | Pending |
| D5 | Documentation language | (1) English docs, Spanish UI (default). (2) Spanish docs too. | S0 | Pending |
| D6 | Barcodes per variant | (1) One (default). (2) Several, delimiter-separated, only with API 2026-10. | S1 | Pending |
| D7 | Tags delimiter and handle conflicts | Default: comma-delimited tags; an existing handle is always a blocking conflict. | S1, S4 | Default, unless the user disagrees |

## Recommendation

Propose S0 foundation next, with this slice plan as the roadmap. Use `productSet` as the primary creation path, the simulated gateway as the only verification path until a development store exists, pin API 2026-07, and settle the XLSX library with an S1 spike. Research is only worth running if a development store is available to resolve the [U] items.

## Appendix: research revision 1 (superseded, kept for the deferred questions)

Revision 1 of the research artifact answered six questions. Revisions 2 and 3 narrowed the request to two. The evidence for the deferred questions (scopes, staged uploads, `productSet`, throttling) and the unsupported items U1 to U8 are preserved below for the later gateway and import-engine changes. Note: claim C5.3 below was re-examined and restated as C5.3b in revision 3.

schema: gentle-ai.sdd-research/v1
change: shopify-importer-01-foundation
revision: 1
outcome: partial
accessed_at: 2026-10-13

### Research: shopify-importer-01-foundation (S0 foundation)

#### Admission

| Class | Tool | Observed | Result |
|---|---|---|---|
| documentation | WebFetch | callable, used for shopify.dev, npm registry, nodejs.org, prisma.io, docs.sheetjs.com, GitHub raw | granted |
| open-web | WebSearch | callable | granted |

Method caveat: WebFetch returns a model-generated reading of each page, so excerpts are the tool's quoted text. Some shopify.dev pages exceed 100,000 characters and were only partly read. Anything not found is marked unsupported rather than filled from memory.

#### Questions

- Q1. Barcode input shape on 2026-10 and 2026-07 to 2026-10 changes affecting the listed operations.
- Q2. Access scopes on 2026-10 for locations, file status, inventory items/levels, shop, and unique-values metafield definitions.
- Q3. stagedUploadsCreate (IMAGE): httpMethod, upload request construction, validity window.
- Q4. productSet: simple product with a single default variant, and handle collision behaviour.
- Q5. Current stable versions and compatibility of the toolchain.
- Q6. Throttling signal and daily variant-creation limit.

#### Sources

| ID | Class | Title | Publisher | URL | Excerpt |
|---|---|---|---|---|---|
| S1 | documentation | ProductVariantsBulkInput (2026-10) | Shopify | https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/ProductVariantsBulkInput | "The barcodes to associate with the product variant. Replaces the entire barcode set." / "A variant accepts up to 20 barcodes, and a given variant input can't set both `barcode` and `barcodes`." `barcode` (String) is marked Deprecated. |
| S2 | documentation | ProductVariantSetInput (2026-10) | Shopify | https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/ProductVariantSetInput | `barcodes: [BarcodeInput!]`, same description as S1; `barcode` (String) marked Deprecated. |
| S3 | documentation | BarcodeInput (2026-10) | Shopify | https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/BarcodeInput | Fields: `type` (BarcodeType, optional; "A `null` format denotes no type provided on write and the value is stored as entered."); `value` (String!, "Maximum length: 255 characters."). |
| S4 | documentation | 2026-10 release notes | Shopify | https://shopify.dev/changelog/release-notes/2026-10.md | "ProductVariant now has a `barcodes` connection for up to 20 typed barcodes." (Sep 8, 2026; singular `barcode` deprecated, returns only the first). "ITEM_NOT_STOCKED_AT_LOCATION error is removed" from inventory quantity mutations and `InventorySetQuantitiesUserErrorCode` (Jun 19, 2026). 2026-10 stable, released October 1, 2026. |
| S5 | documentation | stagedUploadsCreate (2026-10) and StagedUploadInput, StagedUploadHttpMethodType, StagedUploadTargetGenerateUploadResource, StagedMediaUploadTarget, StagedUploadParameter (2026-10) | Shopify | https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/StagedUploadInput (siblings: /enums/StagedUploadHttpMethodType, /enums/StagedUploadTargetGenerateUploadResource, /objects/StagedMediaUploadTarget, /objects/StagedUploadParameter, /mutations/stagedUploadsCreate) | httpMethod: "Default:PUT"; enum values POST and PUT. Resource `IMAGE`: "An image."; `PRODUCT_IMAGE`: "Deprecated". StagedMediaUploadTarget: `url` "Should be used in conjunction with the parameters field"; `resourceUrl` "to be passed as originalSource in CreateMediaInput and FileCreateInput"; StagedUploadParameter has `name` and `value`, both String!. Mutation page: "Send your files to the returned url using the provided parameters for authentication." and "Generate secure, temporary upload URLs for your files." |
| S6 | documentation | productSet (2026-10) and ProductSetInput, ProductSetUserErrorCode | Shopify | https://shopify.dev/docs/api/admin-graphql/2026-10/mutations/productSet (siblings: /input-objects/ProductSetInput, /enums/ProductSetUserErrorCode) | "Requires `write_products` access scope." `HANDLE_NOT_UNIQUE`: "Handle already in use. Please provide a new handle." Handle: "If no handle is explicitly provided, then the title is used to construct the product's handle." productOptions: "maximum of 3 per product". `synchronous`: "Setting `synchronous: false` may be desirable depending on the input complexity/size". All create examples include `productOptions` and `variants`. |
| S7 | documentation | Access scopes reference | Shopify | https://shopify.dev/docs/api/usage/access-scopes | "`read_locations``write_locations` \| `Location`"; "`read_inventory``write_inventory` \| `InventoryItem``InventoryLevel`"; "`read_files``write_files` \| The `File` interface ... the `files` query, and the file mutations, such as `fileCreate` and `fileUpdate`." |
| S8 | documentation | files query, fileCreate, other mutation pages (2026-10) | Shopify | https://shopify.dev/docs/api/admin-graphql/2026-10/queries/files (siblings: /mutations/fileCreate, /inventorySetQuantities, /inventoryActivate, /productByIdentifier, /productReorderMedia, /productVariantAppendMedia, /productVariantsBulkCreate) | files query: "Requires `read_files` access scope, `read_themes` access scope or `read_images` access scope." fileCreate: "Requires `write_files` ... `write_themes` ... or `write_images`"; "Files are processed asynchronously. Check the" `fileStatus`; "The maximum number of files that can be created in a single batch is 250." inventorySetQuantities: "Requires `write_inventory`"; "As of 2026-04, the idempotency key is required and must be provided using the `@idempotent` directive." inventoryActivate: "Requires `write_inventory`"; same idempotency statement; `stockAtLegacyLocation` deprecated. productByIdentifier: "Requires `read_products`"; examples use `handle` and `customId {namespace,key,value}`. productReorderMedia: "Requires `write_products`"; "The operation processes asynchronously". productVariantAppendMedia: "Requires `write_products`". productVariantsBulkCreate: "By default, stores have a limit of 2048 product variants for each product." |
| S9 | documentation | locations query (2026-10) and metafield capability types | Shopify | https://shopify.dev/docs/api/admin-graphql/2026-10/queries/locations | locations page lists no scope line; summary: "A paginated list of inventory locations where merchants can stock". `MetafieldCapabilityUniqueValuesInput`: `enabled` Boolean!; `MetafieldCapabilityUniqueValues` has `eligible` and `enabled`. metafieldDefinitionCreate page: "Requires API client to have access to the namespace and the resource type associated with the metafield definition." |
| S10 | documentation | Shopify API rate limits and API limits | Shopify | https://shopify.dev/docs/api/usage/rate-limits | "Once a store has 500,000 product variants, no more than 10,000 new variants can be created per day, on any API." The variant creation limit does not apply to Shopify Plus stores. "If the bucket fills, you get a throttle error and have to wait for more bucket capacity to become available." The same 10,000/500,000 statement appears at https://shopify.dev/docs/api/usage/limits. |
| S11 | documentation | Admin GraphQL API reference 2026-10 (rate limits and error codes) | Shopify | https://shopify.dev/docs/api/admin-graphql/2026-10 | `THROTTLED`: "The client has exceeded the rate limit. Similar to 429 Too Many Requests." Sample response `extensions.cost` has `requestedQueryCost`, `actualQueryCost`, `throttleStatus{maximumAvailable,currentlyAvailable,restoreRate}`. |
| S12 | open-web | Community and third-party reports on the daily variant limit | Shopify Community, Matrixify, Ablestar | https://matrixify.app/whats-new/shopify-variant-creation-limit/ ; https://community.shopify.com/t/how-to-handle-the-1000-variant-per-day-limit-on-api-uploads/3355/5 | Search result summaries only (no primary fetch). Ablestar and community: 1,000 per day once a store has 50,000 variants (2019 era). Matrixify: 10,000 per 24h once a shop has created 500,000 variants. A Shopify staffer said the limit is subject to change. |
| S13 | documentation | Node.js release schedule | Node.js project | https://raw.githubusercontent.com/nodejs/Release/main/schedule.json | v24: lts 2025-10-28, maintenance 2026-10-20, end 2028-04-30. v26: start 2026-05-05, lts 2026-10-28, end 2029-04-30. v22: maintenance 2025-10-21, end 2027-04-30. v25 end 2026-06-01. |
| S14 | documentation | npm registry metadata and dist-tags (accessed 2026-10-13) | npm | https://registry.npmjs.org/-/package/prisma/dist-tags (also /vite/latest, /@nestjs/core/latest, /vitest/latest, /@tailwindcss/vite/latest, /pnpm/latest, /@prisma/adapter-better-sqlite3/latest, and -/package/{react,tailwindcss,vitest,@playwright/test,sharp,pnpm}/dist-tags) | prisma latest 8.0.0-rc.22, prev 7.10.0, engines.node >=22.18.0 (for 8.0.0-rc.22). @nestjs/core 12.1.3 (node >=20; peer @nestjs/common ^12). vite 8.3.4 (node ^20.19.0 \|\| >=22.12.0). vitest 5.0.4 (node ^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0; peer vite ^6.4.0 \|\| ^7 \|\| ^8). tailwindcss 4.3.3; @tailwindcss/vite 4.3.3 (peer vite ^5.2 \|\| ^6 \|\| ^7 \|\| ^8). react 19.3.0. @playwright/test 1.64.0. sharp 0.35.5. pnpm 12.11.2 (node >=18). @prisma/adapter-better-sqlite3 7.10.0 (better-sqlite3 ^12.6.0). |
| S15 | documentation | Prisma 7 upgrade guide, SQLite page, release status | Prisma | https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7 (also /docs/orm/overview/databases/sqlite, /docs/orm/release-status) | "The way to create a new Prisma Client has changed to require a driver adapter for all databases." "If you are using SQLite, you can use the `@prisma/adapter-better-sqlite3`". "Upgrade to the new `prisma-client` provider"; "The `output` field is now **required** in the generator block." Prerequisites table: Node 20.19.0 minimum, 22.x recommended. "Prisma ORM 8 is a release candidate"; "General availability is expected in October 2026."; Prisma 7 gets fixes "for 18 months" after Prisma 8 GA. |
| S16 | documentation | SheetJS Node.js installation | SheetJS | https://docs.sheetjs.com/docs/getting-started/installation/nodejs | "npm i --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"; the public npm registry is out of date, latest there 0.18.5. |

#### Validated claims

##### Q1 - barcode shape and 2026-07 to 2026-10 changes
- C1.1 Both `ProductVariantSetInput` and `ProductVariantsBulkInput` take `barcodes: [BarcodeInput!]`. It replaces the entire barcode set, accepts up to 20 entries, and one input cannot set both `barcode` and `barcodes`. [S1, S2]
- C1.2 `BarcodeInput` is `{ type: BarcodeType (optional; null stores the value as entered), value: String! (max 255 chars) }`. Typed barcodes are validated against their format standard. [S3]
- C1.3 The singular `barcode: String` is deprecated on both inputs. On `ProductVariant`, `barcodes` is a connection of up to 20 typed barcodes, and the singular field returns only the first. [S1, S2, S4]
- C1.4 2026-10 was released 2026-10-01 and is the current stable version. [S4]
- C1.5 Inventory: `ITEM_NOT_STOCKED_AT_LOCATION` was removed from the inventory quantity mutations and from `InventorySetQuantitiesUserErrorCode`. This affects error handling for `inventorySetQuantities`. [S4]
- C1.6 Idempotency: `inventorySetQuantities` and `inventoryActivate` require an idempotency key via the `@idempotent` directive as of 2026-04. This is already in force on 2026-10. `inventoryActivate`'s `stockAtLegacyLocation` is deprecated. [S8]
- C1.7 The 2026-10 reference pages for `productReorderMedia`, `productVariantAppendMedia`, `fileCreate` and `productByIdentifier` show no deprecation notice for the operations themselves. `productReorderMedia` is asynchronous. `fileCreate` is asynchronous and takes at most 250 files per call. [S8]
- C1.8 The 2026-10 release notes, as read, contain no entries for `productSet`, `stagedUploadsCreate`, `fileCreate`, `productReorderMedia`, `productVariantAppendMedia`, `inventoryActivate` or `productByIdentifier`. Metafield definitions have one entry (Jul 24, 2026): filter queries now return errors for invalid filters. [S4]

##### Q2 - access scopes
- C2.1 `locations` query: Location data is covered by `read_locations`/`write_locations`. The `locations` page itself lists no scope. [S7, S9]
- C2.2 File status: the `files` query requires one of `read_files`, `read_themes` or `read_images`. [S8]
- C2.3 Inventory items and levels are covered by `read_inventory`/`write_inventory`. [S7]
- C2.4 Writes: `fileCreate` requires `write_files`, `write_themes` or `write_images`. `inventorySetQuantities` and `inventoryActivate` require `write_inventory`. `productSet`, `productReorderMedia`, `productVariantAppendMedia` and `productVariantsBulkCreate` require `write_products`. `productByIdentifier` requires `read_products`. [S6, S8]
- C2.5 Unique-values capability: `MetafieldCapabilityUniqueValuesInput` has one field, `enabled: Boolean!`. `metafieldDefinitionCreate` requires "access to the namespace and the resource type associated with the metafield definition". No dedicated scope is stated. [S9]

##### Q3 - stagedUploadsCreate
- C3.1 `httpMethod` is `StagedUploadHttpMethodType` (POST or PUT) with default PUT. [S5]
- C3.2 `IMAGE` is a valid resource ("An image."). `PRODUCT_IMAGE` is deprecated. `fileSize` is only required for VIDEO and MODEL_3D. [S5]
- C3.3 The request goes to the returned `url` together with the returned `parameters` (name/value pairs) used to authenticate the upload. `resourceUrl` is then passed as `originalSource` to `fileCreate`. [S5]
- C3.4 The upload URLs are described as "secure, temporary". [S5]

##### Q4 - productSet
- C4.1 A handle already in use yields the user error code `HANDLE_NOT_UNIQUE`: "Handle already in use. Please provide a new handle." [S6]
- C4.2 If no handle is supplied, it is generated from the title. A handle may contain letters, hyphens and numbers, with no spaces. [S6]
- C4.3 `productSet` requires `write_products`. `synchronous: false` is available for large inputs. The documented create examples all pass `productOptions` plus `variants`. `productOptions` is limited to 3 per product, and variants are created, updated or deleted according to what the input includes. [S6]

##### Q5 - toolchain (as of 2026-10-13)
- C5.1 Node.js: v24 is Active LTS (moves to Maintenance 2026-10-20, end of life 2028-04-30). v26 becomes LTS on 2026-10-28. v22 is Maintenance LTS (end of life 2027-04-30). [S13]
- C5.2 pnpm 12.11.2, Node >=18. NestJS 12.1.3 (`@nestjs/core`; Node >=20). Vite 8.3.4 (Node ^20.19.0 || >=22.12.0). React 19.3.0. Tailwind CSS 4.3.3 with `@tailwindcss/vite` 4.3.3 (peer vite up to ^8). Vitest 5.0.4 (Node ^22.12.0 || ^24.0.0 || >=26.0.0; peer vite ^6.4.0 || ^7 || ^8). Playwright 1.64.0. Sharp 0.35.5. [S14]
- C5.3 Prisma 7 requires a driver adapter for all databases, including SQLite (`@prisma/adapter-better-sqlite3`). It uses the `prisma-client` generator with a required `output`, and `prisma.config.ts` for the URL. Minimum Node is 20.19.0. [S15]
- C5.4 Prisma 8: the npm `latest` dist-tag points to 8.0.0-rc.22 (engines.node >=22.18.0). `prev` is 7.10.0. Prisma docs call Prisma 8 a release candidate with GA expected in October 2026; Prisma 7 gets fixes for 18 months after Prisma 8 GA. The adapter package `@prisma/adapter-better-sqlite3` is at 7.10.0. [S14, S15]
- C5.5 SheetJS CE is installed from the CDN tarball, `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. The npm `xlsx` package is stale at 0.18.5. [S16]
- C5.6 Mutual compatibility (derived from the engine and peer ranges in S14): Node 24 satisfies every engine range above. Vitest 5 accepts Vite 8. Tailwind's Vite plugin accepts Vite 8. NestJS 12 needs `@nestjs/common` ^12. [S14]

##### Q6 - throttling and variant limit
- C6.1 GraphQL throttling is signalled by the error code `THROTTLED`, described as "Similar to 429 Too Many Requests". Responses carry `extensions.cost.throttleStatus` with `maximumAvailable`, `currentlyAvailable` and `restoreRate`. [S11]
- C6.2 Shopify's current official statement is 10,000 new variants per day once a store has 500,000 variants. It applies on any API and does not apply to Shopify Plus stores. [S10]
- C6.3 The per-product variant ceiling is 2048 by default. [S8]

#### Contradictions
- K1 Daily variant limit: S10 (official; rate-limits and limits pages) says 10,000/day past 500,000 variants. S12 (community and third-party, partly 2019-era) says 1,000/day past 50,000 variants. A Matrixify page also gives 10,000/500,000. Resolution by weight: the 1,000/50,000 figure appears only in community and older third-party sources and no official page was found stating it. A Shopify staffer said the limit can change. This is a source-hierarchy resolution, not a contradiction between official pages.
- K2 Node.js previous-releases page: the extracted table had end-of-life dates inconsistent with the official schedule (e.g. v24 end shown as 2026-09-07 vs 2028-04-30). S13 (schedule.json) is used and the page is discarded.
- K3 2026-10 release notes give two end-of-support dates for the version: "at least October 1, 2027" in the text and October 16, 2027 in the table. Not needed for S0.
- K4 Prisma SQLite overview page (read through the tool) described driver adapters as optional. The v7 upgrade guide says they are required for all databases. S15's upgrade guide statement is used. The SQLite page was read through a summarising tool and should be re-checked.

#### Unsupported (no validated claim)
- U1 Access scope for the `shop` query: the page lists none in the portions read; the access-scopes table has no `Shop` row. Unsupported.
- U2 Access scope text on the `locations` query page itself: absent. C2.1 relies only on the scope table.
- U3 Scope specific to creating a metafield definition with unique values (beyond namespace/resource access), and its restrictions (eligible types, post-creation enablement): unsupported. A guide URL returned 404.
- U4 How long a staged upload target stays valid: not stated on any page read. Unsupported.
- U5 A minimal `productSet` payload for a simple product with one default variant: no create example without options and variants was found, and the remaining part of the page (after character 100000) was not readable. Unsupported. Only the update example `productOptions: [] / variants: []` returning `hasOnlyDefaultVariant: true` was seen, and it is not a create example.
- U6 A complete 2026-07 to 2026-10 diff: the release notes were read only for the matching items listed in C1.8. A third-party type-diff reported 28 breaking Admin API changes (secondary source, not verified). Unsupported beyond C1.5, C1.6 and C1.8.
- U7 The exact HTTP status of a throttled GraphQL request: S11 only says "Similar to 429". Unsupported.
- U8 Whether `productSet` auto-suffixes a handle: nothing was found. Only `HANDLE_NOT_UNIQUE` is documented.

#### Uncertainty and freshness
- All pages were accessed 2026-10-13. Versioned 2026-10 URLs were used, except where noted.
- npm dist-tags move daily. Re-resolve versions at scaffold time.
- Prisma `latest` points at a release candidate, so the "stable" Prisma line is 7.10.0 until GA lands.
- Shopify reference pages were summarised by the fetch tool and truncated at 100,000 characters; unseen portions may hold further information.

#### Product choices (non-authoritative; for the orchestrator and user)
- P1 Prisma: pin Prisma 7.10.x with `@prisma/adapter-better-sqlite3` and the `prisma-client` generator until Prisma 8 reaches GA, then plan a separate upgrade.
- P2 Node: target Node 24 LTS (`engines` >=24) so it satisfies every tool's range. Revisit Node 26 after 2026-10-28.
- P3 Barcodes: write `barcodes: [{value, type?}]` and never send the deprecated `barcode`. Cap at 20 per variant.
- P4 Idempotency: generate and persist an idempotency key per inventory mutation so retries are safe.
- P5 Throttling: handle `THROTTLED` from the error body, not only the HTTP status, and read `extensions.cost.throttleStatus` to pace requests. Design for the 10,000/day variant limit on non-Plus stores.
- P6 Staged uploads: use `httpMethod` explicitly, and do not depend on the default PUT.
- P7 Scopes: request the union `write_products`, `write_files`, `write_inventory`, `read_inventory`, `read_locations`, `read_files` and `read_products`. Confirm the scope for `shop` and unique-values definitions against a dev store before finalising.
- P8 Resolve U4, U5 and U8 empirically with a dev-store spike before the product-import slice.
