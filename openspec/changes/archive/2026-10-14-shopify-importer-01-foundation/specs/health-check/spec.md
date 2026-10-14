# Delta for Health Check

## ADDED Requirements

### Requirement: Health endpoint

`GET /health` MUST return a JSON body that reports service status and, as a field, the database check result. It MUST return HTTP 200 when the database check succeeds and HTTP 503 when the database is unreachable, as decided in the design. The body MUST NOT include secrets, configuration values other than the pinned API version, or filesystem paths. The response shape MUST be defined in the contracts package.

#### Scenario: Healthy

- GIVEN a started API with a reachable database
- WHEN `GET /health` is requested
- THEN the response is 200 and the body validates against the contracts schema

#### Scenario: Database down

- GIVEN a started API whose database is unreachable
- WHEN `GET /health` is requested
- THEN the body reports the database check as failed (status code per design)

#### Scenario: No leakage

- GIVEN a configured encryption key
- WHEN `GET /health` is requested
- THEN the body contains neither the key nor any filesystem path

### Requirement: Health is read-only and origin-neutral

`GET /health` MUST be a safe method and MUST NOT be blocked by the write-origin guard.

#### Scenario: Foreign origin read

- GIVEN a request with a non-allow-listed `Origin`
- WHEN it calls `GET /health`
- THEN the handler runs and no CORS allow header is returned

### Requirement: Web shell boot

The web application MUST build and render a minimal shell without any feature screen. The shell MUST obtain health status only via the API using types from the contracts package, and the production bundle MUST NOT contain secrets or server-only code.

#### Scenario: Shell builds and renders

- GIVEN the web application
- WHEN it is built and loaded
- THEN the shell renders without runtime errors

#### Scenario: Bundle free of server code

- GIVEN the production web bundle
- WHEN it is scanned for the API package name and for a seeded secret
- THEN neither is found
