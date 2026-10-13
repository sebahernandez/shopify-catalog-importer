# Delta for Secret Protection

## ADDED Requirements

### Requirement: Authenticated encryption round-trip

`SecretBox` MUST encrypt a plaintext string into an opaque ciphertext and decrypt it back to the identical plaintext, using authenticated encryption. Encrypting the same plaintext twice MUST yield different ciphertexts.

#### Scenario: Round trip

- GIVEN a valid key and plaintext `P`
- WHEN `P` is encrypted and then decrypted
- THEN the result equals `P`

#### Scenario: Non-deterministic output

- GIVEN a valid key and plaintext `P`
- WHEN `P` is encrypted twice
- THEN the two ciphertexts differ

#### Scenario: Ciphertext hides plaintext

- GIVEN plaintext `P`
- WHEN it is encrypted
- THEN the ciphertext does not contain `P`

### Requirement: Tamper and wrong-key rejection

Decryption MUST fail with an explicit error when the ciphertext was modified, truncated, malformed, or produced under a different key. It MUST NOT return partial or garbage plaintext.

#### Scenario: Tampered ciphertext

- GIVEN a valid ciphertext with one byte altered
- WHEN it is decrypted
- THEN decryption raises an error and returns no plaintext

#### Scenario: Wrong key

- GIVEN a ciphertext made under key A
- WHEN it is decrypted with key B
- THEN decryption raises an error

#### Scenario: Malformed input

- GIVEN an empty or non-ciphertext string
- WHEN it is decrypted
- THEN decryption raises an error

### Requirement: External key

The key MUST be supplied from outside the database (environment variable or key file) and MUST NOT be persisted in SQLite or committed to version control. A missing key or a key of invalid length or encoding MUST fail startup of any component that needs `SecretBox`, with an error that does not reveal key material.

#### Scenario: Missing key

- GIVEN no key variable and no key file
- WHEN `SecretBox` is constructed
- THEN construction fails with an error naming the missing key source

#### Scenario: Malformed key

- GIVEN a key of the wrong length
- WHEN `SecretBox` is constructed
- THEN construction fails and the error does not contain the key value

#### Scenario: Key file excluded

- GIVEN a local key file
- WHEN version control status is checked
- THEN the file is ignored

### Requirement: No credential persistence in S0

S0 MUST NOT persist any credential; the persistence baseline holds no secret column in use.

#### Scenario: Empty secret storage

- GIVEN a database after the baseline migration
- WHEN its contents are inspected
- THEN it contains no stored credential
