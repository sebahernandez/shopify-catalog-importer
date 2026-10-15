# Delta for Runtime Configuration

Every other requirement of this capability (validated configuration at startup, loopback defaults, secret-free environment sample) is unchanged. No new environment variable is added by this change: timeouts, attempt counts and size caps are code constants.

## MODIFIED Requirements

### Requirement: Pinned Admin API version

The configuration MUST expose the Shopify Admin GraphQL API version as a single value, defaulting to `2026-10`, and MUST validate it with the pattern `^\d{4}-(01|04|07|10)$`. The value MUST NOT be hard-coded anywhere else: it MUST be read only from configuration, and it MUST be the version used in the request URL of every Shopify Admin API call.
(Previously: S0 only stored and exposed the value, which was never used to call Shopify.)

#### Scenario: Default version

- GIVEN no override for the API version
- WHEN configuration is read
- THEN the API version is `2026-10`

#### Scenario: Malformed version

- GIVEN the API version is set to `latest`
- WHEN the application starts
- THEN startup aborts and the error names the API version variable

#### Scenario: Month outside the quarterly set

- GIVEN the API version is set to `2026-05`
- WHEN the application starts
- THEN startup aborts and the error names the API version variable

#### Scenario: Used on every call

- GIVEN the API version is set to `2027-01`
- WHEN a Shopify read runs through the HTTP adapter
- THEN the request URL contains `2027-01`

#### Scenario: No second source

- GIVEN the source of the stores module
- WHEN it is searched for a version literal
- THEN none is found outside tests and fixtures
