---
schema: gentle-ai.sdd-research/v1
change: shopify-importer-01-foundation
revision: 3
outcome: done
accessed_at: 2026-10-13
supersedes: revision 2
---

# Research: shopify-importer-01-foundation (S0 foundation), revision 3

Revision 3 settles the Prisma driver-adapter point left unvalidated in revision 2 (K4 / V1). Scope is unchanged: Q1 and Q5 only. Source IDs S1 to S4 and S13 to S16 are unchanged; S17 and S18 are new.

## Admission

| Class | Tool | Observed | Result |
|---|---|---|---|
| documentation | WebFetch | callable; used for shopify.dev, npm registry, nodejs.org (GitHub raw schedule), prisma.io, GitHub release pages, docs.sheetjs.com | granted |
| open-web | WebSearch | callable; used for discovery only | granted |

Method caveat: WebFetch returns a model-generated reading of each page, so excerpts are the tool's quoted text rather than raw HTML. Where two readings disagree or a page could not be read in full, the item is stated as such rather than filled from memory.

## Questions

- Q1. On Admin GraphQL API 2026-10, what is the exact barcode/barcodes input shape for product variants (`ProductVariantSetInput`, `ProductVariantsBulkInput`, `BarcodeInput`)?
- Q5. What are the current stable versions and mutual compatibility constraints of Node.js LTS, pnpm, NestJS, Prisma with SQLite (driver adapter requirement, Prisma 8 status), Vite, React, Tailwind CSS, Vitest, Playwright, Sharp and SheetJS CE, as needed to scaffold the workspace today?

## Sources

| ID | Class | Title | Publisher | URL | Excerpt |
|---|---|---|---|---|---|
| S1 | documentation | ProductVariantsBulkInput (2026-10) | Shopify | https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/ProductVariantsBulkInput | "The barcodes to associate with the product variant. Replaces the entire barcode set." / "A variant accepts up to 20 barcodes, and a given variant input can't set both `barcode` and `barcodes`." `barcode` (String) is marked Deprecated. |
| S2 | documentation | ProductVariantSetInput (2026-10) | Shopify | https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/ProductVariantSetInput | `barcodes: [BarcodeInput!]`, same description as S1; `barcode` (String) marked Deprecated. |
| S3 | documentation | BarcodeInput (2026-10) | Shopify | https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/BarcodeInput | Fields: `type` (BarcodeType, optional; "A `null` format denotes no type provided on write and the value is stored as entered."); `value` (String!, "Maximum length: 255 characters."). |
| S4 | documentation | 2026-10 release notes | Shopify | https://shopify.dev/changelog/release-notes/2026-10.md | "ProductVariant now has a `barcodes` connection for up to 20 typed barcodes." (Sep 8, 2026; singular `barcode` deprecated, returns only the first). 2026-10 is stable, released October 1, 2026. |
| S13 | documentation | Node.js release schedule | Node.js project | https://raw.githubusercontent.com/nodejs/Release/main/schedule.json | v24: lts 2025-10-28, maintenance 2026-10-20, end 2028-04-30. v26: start 2026-05-05, lts 2026-10-28, end 2029-04-30. v22: maintenance 2025-10-21, end 2027-04-30. v25 end 2026-06-01. |
| S14 | documentation | npm registry metadata and dist-tags (accessed 2026-10-13) | npm | https://registry.npmjs.org/-/package/prisma/dist-tags (also /vite/latest, /@nestjs/core/latest, /vitest/latest, /@tailwindcss/vite/latest, /pnpm/latest, /@prisma/adapter-better-sqlite3/latest, and -/package/{react,tailwindcss,vitest,@playwright/test,sharp,pnpm}/dist-tags) | prisma latest 8.0.0-rc.22, prev 7.10.0, engines.node >=22.18.0 (for 8.0.0-rc.22). @nestjs/core 12.1.3 (node >=20; peer @nestjs/common ^12). vite 8.3.4 (node ^20.19.0 \|\| >=22.12.0). vitest 5.0.4 (node ^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0; peer vite ^6.4.0 \|\| ^7 \|\| ^8). tailwindcss 4.3.3; @tailwindcss/vite 4.3.3 (peer vite ^5.2 \|\| ^6 \|\| ^7 \|\| ^8). react 19.3.0. @playwright/test 1.64.0. sharp 0.35.5. pnpm 12.11.2 (node >=18). @prisma/adapter-better-sqlite3 7.10.0 (better-sqlite3 ^12.6.0). |
| S15 | documentation | Prisma 7 upgrade guide, SQLite page, release status | Prisma | https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7 (also /docs/orm/overview/databases/sqlite, /docs/orm/release-status) | Upgrade guide: "The way to create a new Prisma Client has changed to require a driver adapter for all databases." SQLite example imports `PrismaBetterSqlite3` from `@prisma/adapter-better-sqlite3` and creates `new PrismaClient({ adapter })`. "Upgrade to the new `prisma-client` provider"; "The `output` field is now **required** in the generator block." Prerequisites: Node 20.19.0 minimum, 22.x recommended. SQLite page: "Instead of Prisma's built-in driver, you can use JavaScript database drivers via driver adapters"; its examples use `new PrismaClient({ adapter })`. Release status: "Prisma ORM 8 is a release candidate"; "General availability is expected in October 2026." |
| S16 | documentation | SheetJS Node.js installation | SheetJS | https://docs.sheetjs.com/docs/getting-started/installation/nodejs | "npm i --save https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"; the public npm registry is out of date, latest there 0.18.5. |
| S17 | documentation | Prisma 7.0.0 release notes | Prisma (GitHub releases) | https://github.com/prisma/prisma/releases/tag/7.0.0 | "requiring users pass either an adapter or `accelerteUrl` [sic] when creating a new instance of `PrismaClient`"; "`new PrismaClient()` support has been removed" (calling the constructor with no arguments, `datasources`, `datasourceUrl` or an empty object is no longer supported). Example: `new PrismaClient({ adapter })` with `PrismaPg`. The Rust-free/ESM client becomes the default in v7.0. |
| S18 | documentation | Prisma Client reference (v7) | Prisma | https://www.prisma.io/docs/orm/reference/prisma-client-reference | Constructor options: `adapter` - "Specifies a driver adapter for database connections." "Required unless using `accelerateUrl`." `accelerateUrl` - "Specifies a Prisma Accelerate URL for remote query execution." "Required unless using `adapter`." (The page was read only up to character 100,000 of 185,118.) |

## Validated claims

### Q1 - barcode input shape (Admin GraphQL 2026-10)
- C1.1 Both `ProductVariantSetInput` and `ProductVariantsBulkInput` take `barcodes: [BarcodeInput!]`. It replaces the entire barcode set, accepts up to 20 entries, and one input cannot set both `barcode` and `barcodes`. [S1, S2]
- C1.2 `BarcodeInput` is `{ type: BarcodeType (optional; null stores the value as entered), value: String! (max 255 chars) }`. Typed barcodes are validated against their format standard. [S3]
- C1.3 The singular `barcode: String` is deprecated on both inputs. On `ProductVariant`, `barcodes` is a connection of up to 20 typed barcodes, and the singular field returns only the first. [S1, S2, S4]
- C1.4 2026-10 was released 2026-10-01 and is the current stable version. [S4]

### Q5 - toolchain (as of 2026-10-13)
- C5.1 Node.js: v24 is Active LTS (moves to Maintenance 2026-10-20, end of life 2028-04-30). v26 becomes LTS on 2026-10-28. v22 is Maintenance LTS (end of life 2027-04-30). [S13]
- C5.2 Current npm `latest` versions: pnpm 12.11.2 (Node >=18); NestJS `@nestjs/core` 12.1.3 (Node >=20); Vite 8.3.4 (Node ^20.19.0 || >=22.12.0); React 19.3.0; Tailwind CSS 4.3.3 with `@tailwindcss/vite` 4.3.3 (peer vite ^5.2 || ^6 || ^7 || ^8); Vitest 5.0.4 (Node ^22.12.0 || ^24.0.0 || >=26.0.0; peer vite ^6.4.0 || ^7 || ^8); Playwright 1.64.0; Sharp 0.35.5. [S14]
- C5.3a Prisma 7 uses the `prisma-client` generator with a required `output`, and `prisma.config.ts` for configuration. Minimum Node is 20.19.0. [S15]
- C5.3b Prisma 7 requires a driver adapter or an Accelerate URL when constructing `PrismaClient`. `new PrismaClient()` with no arguments is no longer supported. `adapter` is "Required unless using `accelerateUrl`". The upgrade guide states the adapter requirement for all databases and shows `@prisma/adapter-better-sqlite3` for SQLite. [S15, S17, S18]
- C5.4 Prisma 8: the npm `latest` dist-tag points to 8.0.0-rc.22 (engines.node >=22.18.0), and `prev` is 7.10.0. Prisma documentation calls Prisma 8 a release candidate with general availability expected in October 2026. `@prisma/adapter-better-sqlite3` is at 7.10.0 (depends on better-sqlite3 ^12.6.0). [S14, S15]
- C5.5 SheetJS CE is installed from the CDN tarball `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`. The npm `xlsx` package is stale at 0.18.5. [S16]
- C5.6 Mutual compatibility (derived from the engine and peer ranges in S14): Node 24 satisfies every engine range above. Vitest 5 accepts Vite 8. Tailwind's Vite plugin accepts Vite 8. NestJS 12 needs `@nestjs/common` ^12. [S14]

## Contradictions
- K2 The nodejs.org previous-releases page, as read by the tool, showed end-of-life dates inconsistent with the official schedule (for example v24 end shown as 2026-09-07 versus 2028-04-30 in schedule.json). S13 (schedule.json) is used and the page is discarded.
- K4 (resolved for the validated claim) Revision 2 recorded that the Prisma SQLite page, as read, described driver adapters as optional ("Instead of Prisma's built-in driver, you can use JavaScript database drivers via driver adapters"), while the v7 upgrade guide said an adapter is required for all databases. Revision 3 fetched two further primary sources: the Prisma 7.0.0 release notes (S17) and the v7 client reference (S18). Both agree with the upgrade guide, and none of the fetched sources for Prisma 7 states that a no-argument `PrismaClient` still works. The raw MDX source of the SQLite page (prisma/docs repository) returned HTTP 404, so whether the SQLite-page sentence is version-scoped or stale text could not be determined. This artifact makes no claim based on that sentence. Resolution: C5.3b stands on S15, S17 and S18.

## Uncertainty and freshness
- All pages were accessed 2026-10-13. Barcode pages are the versioned 2026-10 URLs.
- npm dist-tags move daily; re-resolve versions when scaffolding.
- Prisma `latest` points at a release candidate, so the stable Prisma line is 7.10.0 until GA lands; GA is expected in October 2026.
- The error raised when neither `adapter` nor `accelerateUrl` is passed was not found in the portion of S18 that was read (characters 0 to 100,000 of 185,118). It is not claimed here.
- `accelerateUrl` is documented as the alternative to `adapter` for Prisma Accelerate (remote query execution). Applying that to a local SQLite file, so that the adapter route is the one the project would use, is a reading of S17 and S18, not a verbatim statement from them.
- The fetch tool summarises pages; excerpts are the tool's quoted text.
- The Node.js LTS picture changes on 2026-10-20 (v24 to Maintenance) and 2026-10-28 (v26 LTS).

## Product choices (non-authoritative; for the orchestrator and user)
- P1 Prisma: pin Prisma 7.10.x with the `prisma-client` generator and `@prisma/adapter-better-sqlite3`. Plan a separate upgrade once Prisma 8 reaches GA.
- P2 Node: target Node 24 LTS (`engines` >=24), which satisfies every tool's range. Revisit Node 26 after 2026-10-28.
- P3 Barcodes: write `barcodes: [{value, type?}]`, never the deprecated `barcode`, and cap at 20 per variant.

## Deferred questions
By user decision on 2026-10-13, the former Q2, Q3, Q4, Q6 and the cross-operation 2026-07 to 2026-10 diff were removed from this change's request. Their evidence remains in revision 1. The unsupported items U1 to U8 from revision 1 are carried to the later gateway and import-engine changes.
