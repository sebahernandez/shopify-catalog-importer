# Delta for Runtime Configuration

## ADDED Requirements

### Requirement: Validated configuration at startup

The application MUST validate all configuration before accepting requests. Invalid or missing required values MUST abort startup with an error naming each offending variable, and the error MUST NOT contain the value of any secret.

#### Scenario: Valid configuration

- GIVEN all required variables are set and valid
- WHEN the application starts
- THEN it starts without configuration errors

#### Scenario: Malformed port

- GIVEN the port variable is `abc`
- WHEN the application starts
- THEN startup aborts and the error names the port variable

### Requirement: Pinned Admin API version

The configuration MUST expose the Shopify Admin GraphQL API version as a single value, defaulting to `2026-10`. The value MUST NOT be hard-coded anywhere else. S0 only stores and exposes it; it is never used to call Shopify.

#### Scenario: Default version

- GIVEN no override for the API version
- WHEN configuration is read
- THEN the API version is `2026-10`

#### Scenario: Malformed version

- GIVEN the API version is set to `latest`
- WHEN the application starts
- THEN startup aborts and the error names the API version variable

### Requirement: Loopback defaults

The default host MUST be a loopback address and the port MUST have a documented default. Host and port MUST be configurable.

#### Scenario: Defaults

- GIVEN no host or port overrides
- WHEN configuration is read
- THEN the host is a loopback address and the port is the documented default

### Requirement: Secret-free environment sample

The repository MUST include an environment sample listing every variable with a placeholder or empty value, and MUST NOT include any real secret. The real environment file MUST be excluded from version control.

#### Scenario: Sample is complete

- GIVEN the environment sample
- WHEN its variables are compared with the configuration schema
- THEN every schema variable appears in the sample

#### Scenario: Real env ignored

- GIVEN a populated local environment file
- WHEN version control status is checked
- THEN the file is ignored
