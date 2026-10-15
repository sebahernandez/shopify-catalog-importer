# Delta for Persistence Baseline

The existing requirements (local SQLite access, baseline migration, database readiness signal) are unchanged in wording. The baseline migration still creates only `app_setting`; the store table comes from a second migration.

## ADDED Requirements

### Requirement: Store table migration

A second migration MUST create the table `store` with the columns `id` (text primary key), `display_name`, `shop_domain`, `shopify_shop_id` (nullable), `api_version` (nullable), `auth_kind`, `credentials_envelope`, `status`, `last_verified_at` (nullable), `last_verification` (nullable text) and `created_at` and `updated_at` (datetime, like `app_setting`). It MUST apply cleanly to a database at the baseline and to an empty file, MUST keep existing `app_setting` rows, and MUST NOT be re-applied when re-run. After it, the migration history MUST list the baseline and this migration, and the set of tables MUST be exactly `_prisma_migrations`, `app_setting` and `store`.

#### Scenario: Upgrade from baseline

- GIVEN a database at the baseline with a key-check row in `app_setting`
- WHEN migrations are applied
- THEN `store` exists and the `app_setting` row is unchanged

#### Scenario: Empty file

- GIVEN an empty SQLite file
- WHEN migrations are applied
- THEN both migrations are recorded and the table set is `_prisma_migrations`, `app_setting`, `store`

#### Scenario: Re-apply

- GIVEN a database with both migrations
- WHEN migrations are applied again
- THEN nothing changes and exit is 0

### Requirement: Unique canonical domain constraint

The table `store` MUST enforce uniqueness of `shop_domain` at the database level, independent of application checks. Status and auth kind are stored as text; the allowed values are enforced by the application and contracts, and `last_verification` MUST be stored as TEXT (JSON), not as a JSON column type.

#### Scenario: Duplicate insert

- GIVEN a row with `shop_domain` `demo.myshopify.com`
- WHEN a second row with the same value is inserted directly
- THEN the database rejects it with a unique constraint error

#### Scenario: Snapshot column type

- GIVEN the table definition
- WHEN the type of `last_verification` is read
- THEN it is TEXT

### Requirement: Credentials only as an envelope column

The table `store` MUST hold credentials only in `credentials_envelope`, as a `SecretBox` envelope. No column MUST store a plaintext token, client id, client secret or a masked or hashed form of them.

#### Scenario: Column list

- GIVEN the table definition
- WHEN its columns are listed
- THEN the only column that can hold a credential is `credentials_envelope`

#### Scenario: Row content

- GIVEN a row created with canary credentials
- WHEN all columns of the row are read
- THEN no column contains a canary and `credentials_envelope` starts with `sb1.`

### Requirement: Startup check covers every expected table

On startup the persistence layer MUST verify that every expected table exists (`app_setting` and `store`, and any table added by later migrations that the application lists as expected) and MUST refuse to continue with the `MIGRATION_REQUIRED` error when any of them is missing, not only `app_setting`. The error MUST NOT apply a migration by itself and MUST NOT reveal any data.

#### Scenario: Store table missing

- GIVEN a database at the baseline (it has `app_setting` but not `store`)
- WHEN the application starts
- THEN startup aborts with `MIGRATION_REQUIRED`

#### Scenario: App setting missing

- GIVEN a database without `app_setting`
- WHEN the application starts
- THEN startup aborts with `MIGRATION_REQUIRED`

#### Scenario: Fully migrated

- GIVEN a database with both migrations applied
- WHEN the application starts
- THEN the check passes and startup continues

#### Scenario: No automatic migration

- GIVEN the failing startup above
- WHEN the database is inspected afterwards
- THEN it is unchanged
