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

The key MUST be supplied from outside the database, from a key file only. The key file path MUST be given by the `SECRET_KEY_FILE` variable, and no environment variable MUST carry key material. The key MUST NOT be persisted in SQLite or committed to version control. A key of invalid length or encoding MUST fail startup of any component that needs `SecretBox`, with an error that does not reveal key material. A missing key file MUST be handled as specified in the scenarios below, and no error MUST reveal key material.

#### Scenario: Missing key file at construction

- GIVEN no key file at the `SECRET_KEY_FILE` path
- WHEN `SecretBox` is constructed without a keyring
- THEN construction fails with `KEY_MISSING` naming `SECRET_KEY_FILE`

#### Scenario: Missing key file at boot with no stored key check

- GIVEN no key file at the `SECRET_KEY_FILE` path and no key-check row in the database
- WHEN the application boots
- THEN a key is generated into the key file, the key-check row is written, and a one-time warning asks the operator to back up the key file

#### Scenario: Missing key file at boot with a stored key check

- GIVEN no key file at the `SECRET_KEY_FILE` path and a key-check row in the database
- WHEN the application boots
- THEN startup aborts with `KEY_FILE_REQUIRED` and no key is regenerated

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
