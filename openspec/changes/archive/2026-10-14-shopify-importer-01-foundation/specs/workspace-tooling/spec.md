# Delta for Workspace Tooling

## ADDED Requirements

### Requirement: Workspace layout

The repository MUST be a pnpm workspace with three packages: an API application, a web application and a shared contracts package. The web application MUST NOT declare a dependency on the API application. The web application MAY depend on the contracts package.

#### Scenario: Web isolated from API

- GIVEN the workspace manifests
- WHEN the web application's declared dependencies are inspected
- THEN none of them references the API application

#### Scenario: Web depends on contracts only

- GIVEN the workspace manifests
- WHEN the web application's workspace dependencies are listed
- THEN the contracts package is the only workspace package listed

### Requirement: Reproducible install

A frozen-lockfile install MUST succeed on the supported Node major version, and the supported Node floor MUST be declared in the root manifest.

#### Scenario: Frozen install

- GIVEN a clean checkout and the supported Node version
- WHEN a frozen-lockfile install runs
- THEN it exits 0 and the lockfile is unchanged

#### Scenario: Unsupported Node version

- GIVEN a Node version below the declared floor
- WHEN install runs with engine checks enforced
- THEN the install reports the engine mismatch

### Requirement: Strict compilation

All workspace packages MUST compile under strict TypeScript settings, and a type error in any package MUST fail the root typecheck script.

#### Scenario: Clean typecheck

- GIVEN the scaffolded workspace
- WHEN the root typecheck script runs
- THEN it exits 0

#### Scenario: Type error detected

- GIVEN a deliberate type error in one package
- WHEN the root typecheck script runs
- THEN it exits non-zero and names the file

### Requirement: Root quality scripts

The root MUST expose scripts for typecheck, lint, format check, test, build and development. Lint, format check, typecheck, test and build MUST each exit 0 on a clean tree and non-zero on a violation.

#### Scenario: All gates pass

- GIVEN a clean tree
- WHEN typecheck, lint, test and build run from the root
- THEN every command exits 0

#### Scenario: Failing test fails the gate

- GIVEN a deliberately failing test
- WHEN the root test script runs
- THEN it exits non-zero

### Requirement: Spanish quick-start documentation

The root README MUST be written in Spanish and MUST document prerequisites (including the native SQLite driver build requirement), install, run and test steps, and the consequence of losing the encryption key. Code, comments and identifiers MUST remain in English.

#### Scenario: README boot path

- GIVEN a machine with the documented prerequisites
- WHEN the README steps are followed in order
- THEN the application starts and the health endpoint responds

#### Scenario: Key loss documented

- GIVEN the README
- WHEN its content is reviewed
- THEN it states that losing the key makes encrypted secrets unrecoverable
