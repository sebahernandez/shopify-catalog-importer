# Delta for Local Security Baseline

## ADDED Requirements

### Requirement: Loopback-only binding

The API MUST bind to a loopback address by default. Binding to a non-loopback address MUST be refused at startup unless the operator gives an explicit opt-in; the opt-in mechanism is a design decision.

#### Scenario: Default bind

- GIVEN default configuration
- WHEN the API starts
- THEN it listens only on a loopback address

#### Scenario: Non-loopback without opt-in

- GIVEN the host is set to `0.0.0.0` and no opt-in is given
- WHEN the API starts
- THEN startup aborts with an error naming the host setting

#### Scenario: Non-loopback with opt-in

- GIVEN the host is non-loopback and the explicit opt-in is given
- WHEN the API starts
- THEN it listens on that host

### Requirement: Restrictive CORS

The API MUST allow cross-origin requests only from an explicit allow-list of origins (the local web application). It MUST NOT use a wildcard origin.

#### Scenario: Allowed origin preflight

- GIVEN an allow-listed origin
- WHEN it sends a preflight request
- THEN the response allows that origin

#### Scenario: Disallowed origin preflight

- GIVEN an origin not on the allow-list
- WHEN it sends a preflight request
- THEN the response carries no allow-origin header for it

### Requirement: Origin guard on write endpoints

Every state-changing request (non-safe HTTP method) MUST be rejected with a 403 response when its `Origin` header is present and not allow-listed. Safe-method requests MUST NOT be affected. The guard SHALL apply to all current and future write endpoints and be verifiable in S0 with a test-only write route.

#### Scenario: Foreign origin write

- GIVEN a write route
- WHEN a POST arrives with `Origin: https://evil.example`
- THEN the response is 403 and the handler does not run

#### Scenario: Allowed origin write

- GIVEN a write route
- WHEN a POST arrives with an allow-listed `Origin`
- THEN the handler runs

#### Scenario: Missing origin write

- GIVEN a write route
- WHEN a POST arrives with no `Origin` header
- THEN the behaviour follows the design decision documented for this case (proposed default: allow, since non-browser local clients send none)

### Requirement: Secret redaction in logs

The logger MUST redact secret-shaped values from messages and structured fields before output. Redaction MUST cover values under known secret-bearing keys (for example token, key, secret, password, authorization) and the configured encryption key value.

#### Scenario: Seeded secret in a field

- GIVEN a log call with a field `accessToken: "shpat_seed123"`
- WHEN the line is emitted
- THEN the output does not contain `shpat_seed123`

#### Scenario: Seeded secret in a message

- GIVEN a configured key value `K`
- WHEN a message containing `K` is logged
- THEN the output does not contain `K`

#### Scenario: Non-secret preserved

- GIVEN a log call with field `count: 3`
- WHEN the line is emitted
- THEN the output contains `3`
