# Delta for Money Value Object

Proposed defaults (not confirmed decisions): `.` is the only decimal separator; thousands separators are rejected as ambiguous. Currency-scale validation requires a store lookup and is out of scope for S0.

## ADDED Requirements

### Requirement: Canonical decimal parsing

`Money` MUST parse an amount string into a canonical decimal string without any floating-point conversion. Valid input is an optional leading `-`, digits, and optionally `.` followed by digits. Output MUST preserve every significant digit.

#### Scenario: Preserves precision

- GIVEN the input `"0.1"` and `"0.2"`
- WHEN they are added
- THEN the result is exactly `"0.3"`

#### Scenario: Large and long values

- GIVEN the input `"12345678901234567890.123456789"`
- WHEN parsed and serialized
- THEN the output equals the input

#### Scenario: Canonicalization

- GIVEN the input `"007.50"`
- WHEN parsed
- THEN the canonical form is a single, documented representation, identical for equal values

### Requirement: Ambiguous and malformed amounts are rejected

`Money` MUST reject, with an explicit error and never a guess, inputs that are ambiguous or malformed: thousands separators or a comma decimal (for example `"1,234"`, `"1.234,56"`), empty or whitespace-only strings, multiple separators, exponent notation, non-numeric characters, and `NaN` or infinity literals.

#### Scenario: Comma ambiguity

- GIVEN the input `"1,234"`
- WHEN parsed
- THEN an ambiguity error is raised

#### Scenario: Malformed inputs

- GIVEN each of `""`, `"1.2.3"`, `"1e3"`, `"abc"`, `"NaN"`
- WHEN parsed
- THEN each raises a validation error

#### Scenario: Non-string input

- GIVEN a JavaScript number such as `0.1`
- WHEN passed to the parser
- THEN it is rejected, since numbers have already lost precision

### Requirement: Immutable value semantics

`Money` instances MUST be immutable and compared by value. Operations MUST return new instances.

#### Scenario: Equality by value

- GIVEN two instances parsed from `"1.50"` and `"1.5"`
- WHEN compared
- THEN they are equal

#### Scenario: Operation leaves operands unchanged

- GIVEN instance `a`
- WHEN `a` is added to another amount
- THEN `a` is unchanged

### Requirement: Contract-safe serialization

`Money` MUST serialize to and from its canonical string for transport in the contracts package, never as a JSON number.

#### Scenario: JSON round trip

- GIVEN a `Money` value
- WHEN serialized to JSON and parsed back
- THEN the value is equal and the JSON representation is a string
