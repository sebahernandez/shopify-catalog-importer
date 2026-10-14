# Persistence Baseline

## Requirements

### Requirement: Local SQLite access

The API MUST access a local SQLite database file through a database client wired with an explicitly configured SQLite driver adapter. The file location MUST be configurable and MUST default to a path ignored by version control. No server process (Redis, Docker, database server) MAY be required.

#### Scenario: Connect to configured file

- GIVEN a database path in configuration
- WHEN the API starts
- THEN it opens that file, creating it if absent

#### Scenario: Unwritable path

- GIVEN a database path in a non-writable directory
- WHEN the API starts
- THEN startup aborts with an error naming the path setting

### Requirement: Baseline migration

A baseline migration MUST apply cleanly to an empty SQLite file and MUST be idempotent when re-run (already-applied migrations are not re-applied). Its table contents are a design decision.

#### Scenario: Apply to empty database

- GIVEN an empty SQLite file
- WHEN migrations are applied
- THEN they complete with exit 0 and the migration history records the baseline

#### Scenario: Re-apply

- GIVEN a database with the baseline applied
- WHEN migrations are applied again
- THEN nothing changes and exit is 0

### Requirement: Database readiness signal

The persistence layer MUST expose a connectivity check usable by the health check.

#### Scenario: Reachable

- GIVEN a migrated database
- WHEN the connectivity check runs
- THEN it reports success

#### Scenario: Unreachable

- GIVEN the database file is removed or locked unusably
- WHEN the connectivity check runs
- THEN it reports failure without throwing an unhandled error
