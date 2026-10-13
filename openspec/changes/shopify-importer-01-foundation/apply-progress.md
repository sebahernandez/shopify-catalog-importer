# Apply Progress: shopify-importer-01-foundation

Mode: U1 and U2 Standard (strict_tdd was false); U3 onward Strict TDD (strict_tdd true).

## Batch 1: U1 Workspace tooling, test runner, contracts base

Branch `feat/foundation-u1-workspace-tooling`. Tasks 1.1 to 1.11 complete (11/11 of Phase 1; 11 of 61 overall).

Resolved versions (exact pins): pnpm 12.11.2, TypeScript 6.0.3, ESLint 10.12.0,
typescript-eslint 8.71.2, Prettier 3.9.10, eslint-config-prettier 10.1.8, Vitest 5.0.4, zod 4.6.7,
@eslint/js 10.0.1, globals 17.13.0, @types/node 24.19.2.

Notes for later units:
- TypeScript is pinned to 6.0.3, not the registry `latest` 7.0.2, because typescript-eslint 8.71.2
  declares peer `typescript >=4.8.4 <6.1.0`.
- pnpm 12 runs `pre*` scripts, so root `predev`, `pretypecheck` and `pretest` build contracts.
- Strict engine check is `engineStrict: true` in `pnpm-workspace.yaml`.
- `tsconfig.base.json` sets `types: ["node"]` (TypeScript 6 no longer includes `@types/*` implicitly).
- Contracts keeps `tsconfig.json` (typecheck, includes tests) and `tsconfig.build.json` (emit, excludes tests).
- Root `prettier --write .` touches `.atl/`; it is now in `.prettierignore`.

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/contracts test`: 3 files passed, 14 tests passed, 2 skipped (web invariants, vacuous until U15) |
| Runtime harness | `pnpm install --frozen-lockfile && pnpm check && pnpm build` from root: all exit 0, lockfile unchanged |
| Rollback boundary | Whole unit; repo returns to the planning artifacts only |

## Batch 2: U2 API skeleton and spikes

Branch `feat/foundation-u2-api-skeleton`. Tasks 2.1 to 2.5 complete (5/5 of Phase 2; 16 of 61 overall). No fallback applied.

Spike outcomes (inputs for CP2 and CP3):

| Spike | Verdict | Evidence |
|---|---|---|
| ESM (item 1) | PASS, no fallback | `nest build` output run with plain `node dist/main.js` on Node 24 booted a Nest 12 app (top-level await) on an ephemeral loopback port. `nest start --watch` compiled, started, and after a source edit recompiled and restarted. The API stays ESM; CP3 needs no CommonJS re-read. |
| DI under Vitest (item 2) | PASS, no plugin | Explicit `@Inject(TOKEN)` resolves with no `emitDecoratorMetadata` (needs `experimentalDecorators` only). Negative control: removing `@Inject` makes the provider arrive undefined and the test fail. |
| Native driver (items 4 and 7) | PASS | `better-sqlite3` 12.11.1 installs via prebuilt binary or local build; `allowBuilds` in `pnpm-workspace.yaml` is required (without it `pnpm add` fails with `ERR_PNPM_IGNORED_BUILDS`). In-memory `SELECT 1` and the adapter factory both work. |

Resolved versions (exact pins): @nestjs/common, @nestjs/core, @nestjs/platform-express 12.1.3, @nestjs/cli 12.0.8,
reflect-metadata 0.2.2, rxjs 7.8.2, better-sqlite3 12.11.1, @prisma/adapter-better-sqlite3 7.10.0,
@types/better-sqlite3 9.6.0. Vitest stays at 5.0.4.

Notes for later units:
- `better-sqlite3` is pinned to 12.11.1 because the adapter depends on `^12.6.0`; registry latest is 13.0.3.
- The API `build` script is `nest build`; `dev` is `nest start --watch`. Nest CLI looks for `dist/main.js`, so U13 must add `main.ts` at the source root.
- `apps/api/tsconfig.json` sets `experimentalDecorators: true`; do not enable `emitDecoratorMetadata` (conflicts with `verbatimModuleSyntax` and is unneeded).
- U2 does not depend on `@importer/contracts` yet; add `workspace:*` when first imported.
- The spike scaffold `main.ts` used for the watch run was removed; U13 owns the real one.

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/api test`: 2 files passed, 4 tests passed |
| Runtime harness | `nest build` then plain `node dist/main.js` boot, and `nest start --watch` edit-restart, both on an ephemeral loopback port, processes stopped |
| Rollback boundary | `apps/api/**` plus the `allowBuilds` lines in `pnpm-workspace.yaml` and the lockfile delta |

## Batch 3: U3 Money

Branch `feat/foundation-u3-money`. Tasks 3.1 to 3.4 complete (4/4 of Phase 3; 20 of 61 overall). Mode: Strict TDD.
Commits: f613b83 (Money value object plus tests), cbf35e8 (MoneyString, cross-check test, contracts dependency).

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|---|---|---|---|---|---|---|---|
| 3.1/3.2 | apps/api/src/shared-kernel/money/money.test.ts | Unit | N/A (new) | Failed: Cannot find module './money.js' | 95/95 passed | Tables: 14 canonical, 1 comma set of 5, 23 malformed, 6 non-string, add, compare, toFixed | Lint autofix only (removed one redundant assertion); tests stayed green |
| 3.3 | packages/contracts/src/money.test.ts | Unit | 14 existing contracts tests green | Failed: Cannot find module './money.js' | 28/28 passed | 9 accepted, 15 rejected, 4 non-string | None needed |
| 3.4 | apps/api/src/shared-kernel/money/money-contract.int.test.ts | Integration | N/A (new) | Failed: Cannot find package '@importer/contracts' | 122/122 passed after adding workspace:* dependency | 13 samples x 2 checks plus a sum | None needed |

### Decisions and deviations

- `MoneyError` carries `AMBIGUOUS_SEPARATOR` and `INVALID_FORMAT` as specified. Two extra codes cover `toFixed` misuse, which tasks.md leaves unnamed: `SCALE_EXCEEDED` and `INVALID_SCALE`.
- A comma input is ambiguous only when the string is made of digits, `.`, `,` and an optional leading `-`; other comma-bearing garbage (for example `a,b`) is INVALID_FORMAT.
- `MoneyString` regex excludes negative zero (`-0`), which the D5 regex literal would accept but the D5 prose forbids. Money never emits `-0`.
- `apps/api` now depends on `@importer/contracts` via `workspace:*` (lockfile +3 lines). `money.ts` itself imports nothing.
- Hand-written size: 503 added lines (tests 352, source 151) against a 400 budget and a ~300 forecast. Not trimmed; reported to the orchestrator.

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/api exec vitest run src/shared-kernel/money`: 2 files passed, 122 tests passed |
| Runtime harness | N/A: pure value object, no runtime boundary. Root `pnpm check` (126 API, 42 contracts tests) and `pnpm build` exit 0 |
| Rollback boundary | shared-kernel/money/**, packages/contracts/src/money*, the index.ts export line, the api dependency line and its lockfile delta |

## Batch 4: U4 redact() and spec alignment

Branch `feat/foundation-u4-redact`. Tasks 4.1 to 4.3 complete (3/3 of Phase 4; 23 of 61 overall). Mode: Strict TDD.
Commits: 067e614 (spec wording), 1b68255 (redact() plus tests).

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|---|---|---|---|---|---|---|---|
| 4.1 | N/A (spec wording only) | N/A | N/A | N/A | Re-read: no scenario uses a bare key name | N/A | N/A |
| 4.2/4.3 | apps/api/src/shared-kernel/logging/redact.test.ts | Unit | N/A (new) | Failed: Cannot find module './redact.js' | 72/72 passed | 16 plus 4 secret key names, 7 preserved names, 3 token prefixes, 8 adversarial inputs, all spec scenarios | Dropped an untested speculative stem; prettier and a Map type annotation only |

Mutation check: removing the longest-first sort failed the overlap test; raising the depth cap failed the deep-structure test.

### Decisions where the design was silent or ambiguous

- Bare `key` is not secret (also protects the `app_setting.key` column). Secret key forms: a name ending in api, private, encryption, access, signing, master or auth plus `key`, after removing `-`, `_` and spaces.
- Secret-named keys: the whole value is replaced, whatever its type, and is never read.
- Error: output is a plain object of name plus all own property names (stack, message, cause, extra fields), each redacted by the same rules. Date: ISO string. Map: array of entries. Set: array. Buffer, typed arrays, ArrayBuffer: a byte-count marker, never content. Class instances: own enumerable properties. toJSON is honoured and its result is redacted. Functions: [Function]. Symbols: redacted description.
- Bounds: depth 12, 10,000 visited nodes and entries; beyond that [Truncated]. Cycle: [Circular] (ancestor path only, so shared references are not flagged).
- Never throws: an unreadable node becomes [Unredactable] (leak-safe) instead of failing the log call.
- API: redact, redactString (for the logger message path), registerSecret (returns false below 8 characters), isSecretKeyName, exported constants, and a clearRegisteredSecretsForTests seam (registry is process-wide).

### What redact() does not catch

Secrets in free text that match no pattern and are not registered; secrets in object keys or Map keys; symbol-keyed properties; key=value pairs in plain text outside URLs; non-Shopify vendor token formats; secrets split across fields or encoded (base64, URL-encoded) unless the encoded form is registered; data past the depth or node caps (dropped, not leaked). Key-name matching over-redacts names containing token, secret and similar (for example max_tokens).

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/api exec vitest run src/shared-kernel/logging/redact`: 1 file, 72 tests passed |
| Runtime harness | N/A: pure function, no runtime boundary. Root `pnpm check` (198 API, 42 contracts tests) exit 0 |
| Rollback boundary | shared-kernel/logging/redact*; the spec wording edit is a separate commit |
| Size | 574 hand-written added lines (source 212, tests 362) against a 400 budget; not trimmed |

## Batch 5: U5 RedactingLogger

Branch `feat/foundation-u5-redacting-logger`. Tasks 5.1 to 5.3 complete (3/3 of Phase 5; 26 of 61 overall). Mode: Strict TDD.

### Task 5.1 finding (design item 8)

Read from the installed type declarations of @nestjs/common 12.1.3 (logger.service.d.ts). `LoggerService` requires only `log`, `error` and `warn`, each `(message: any, ...optionalParams: any[]): any`. `debug?`, `verbose?`, `fatal?` and `setLogLevels?(levels: LogLevel[])` are optional. Difference from the design: it assumed a generic "NestJS logger interface"; the required set is just three methods and the rest is optional. `RedactingLogger` implements all six log methods and omits `setLogLevels` (level is fixed at construction).

### Design deviation

D8 and task 5.3 allowed importing the NestJS interface type. The implemented kernel imports nothing from NestJS: the D2 shared-kernel lint rule (`@nestjs/*` pattern, no `allowTypeImports`) rejects even `import type`, verified with a probe file (exit 1, no-restricted-imports). The lint rule was kept as is and design.md untouched. Replacement: a local `LoggerPort` in shared-kernel/logging/logger.port.ts with the same six methods, typed with `unknown` instead of `any` (parameters are contravariant, so it stays assignable to Nest's `LoggerService`; not yet compile-checked, see carry-over). Decision by the orchestrator.

Carry-over for U13: assert RedactingLogger is assignable to LoggerService at the composition root. A note was added under Phase 13 in tasks.md.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|---|---|---|---|---|---|---|---|
| 5.2/5.3 | apps/api/src/shared-kernel/logging/redacting-logger.test.ts | Unit | N/A (new) | Failed: Cannot find module './redacting-logger.js' | 32/32 passed | Line shape, 6 method-to-level mappings, 4 level thresholds, secrets via field, object message, string message, params, error stack arg, Error and cause, Map/Set, sink failure and recovery, BigInt, cycle, throwing toJSON/getter/clock, no args and odd types | Strengthened the Error test (it passed vacuously when unredacted: JSON.stringify of a raw Error is {}); lint fix in a test |

Mutation check: replacing `redact(message)` and `redact(params)` with the raw values failed 9 tests.

### Decisions where the design was silent

- Line shape: `{time, level, message, params?}`; `params` holds all optional parameters (including Nest's stack and context strings) redacted as one array. No context extraction.
- Levels: error, warn, info, debug (the LOG_LEVEL domain). log maps to info, verbose to debug, fatal to error. Filtered events are not built or redacted. The logger does not read the environment; U13 passes the parsed LOG_LEVEL.
- Sink failure: the event is dropped and counted in `droppedEvents`; nothing is written to stdout, stderr or console, because a fallback channel would carry the same data. A throwing clock or unbuildable event is dropped the same way. Tested.
- BigInt becomes a redacted string; a failed property read or toJSON becomes a marker from redact().
- Limit: a dropped event is invisible except through the counter; U13 may expose it.

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/api exec vitest run src/shared-kernel/logging/redacting-logger`: 1 file, 32 tests passed |
| Runtime harness | N/A: no runtime boundary (sink injected, no Nest wiring until U13). Root `pnpm check` (230 API, 42 contracts tests) exit 0 |
| Rollback boundary | shared-kernel/logging/logger.port.ts, redacting-logger.ts and its test; the tasks.md/apply-progress.md edits |

## Batch 6: U6 SecretBox

Branch `feat/foundation-u6-secret-box`. Tasks 6.1 to 6.3 complete (3/3 of Phase 6; 29 of 61 overall). Mode: Strict TDD.
Commits: 9097b2c (ports), e85359a (AesGcmSecretBox, SecretBoxError, tests, task checkboxes).

### Path deviation

The source folder is `apps/api/src/shared-kernel/secret-box/`, not `shared-kernel/secrets/` as design.md still says. The user's Claude Code settings deny Read and Edit on any path matching a `secrets` folder, so the orchestrator renamed it (commit d385571 updated tasks.md). design.md is intentionally untouched.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|---|---|---|---|---|---|---|---|
| 6.1 | N/A (type-only ports) | N/A | N/A | N/A | Lint and typecheck clean | N/A: interfaces only, no behaviour | None needed |
| 6.2/6.3 | apps/api/src/shared-kernel/secret-box/aes-gcm-secret-box.test.ts | Unit | N/A (new) | Failed: Cannot find module './secret-box-error.js' | 88/88 passed | 9 round-trip inputs, 7 key lengths, 7 bad keyrings, 6 tamper-to-DECRYPT_FAILED, 28 malformed-envelope cases, key-id and context swaps, rotation, hygiene dump of 6 failures | Replaced `isWellFormed()` (not in the TS lib) with a `\p{Surrogate}` unicode regex; fixed a test that leaked-checked a 1-byte key (matched by chance) |

### Mutation check (each restored and re-run green, 88/88)

| Mutation | Result |
|---|---|
| Remove setAAD on decrypt | 15 tests failed |
| Remove setAAD on encrypt | 16 failed |
| Skip setAuthTag on decrypt | 15 failed |
| Fixed nonce (constant IV) | 1 failed (non-determinism test) |
| Drop the 16-byte tag length check in the parser | 3 failed |
| Drop the canonical base64url round-trip check | 1 failed |
| Drop `authTagLength` from createDecipheriv | SURVIVED (88 passed). Equivalent mutant: the parser already rejects any tag that is not exactly 16 bytes before the decipher exists, so the option is defence in depth that no public input can reach |

### Format and decisions

- Envelope `sb1.<keyId>.<iv>.<ciphertext>.<tag>`, base64url without padding, 12-byte random IV per call, 16-byte tag, AAD `sb1|<keyId>|<context>`. Version marker is validated by the parser (unknown version gives MALFORMED_ENVELOPE) and is part of the AAD.
- `Keyring { activeKeyId, keys: ReadonlyMap<string, Uint8Array> }` defined in key-provider.port.ts (the design uses it without defining it). New writes use `activeKeyId`; any key in the map can decrypt.
- Codes: KEY_MISSING, INVALID_KEY, INVALID_INPUT, MALFORMED_ENVELOPE, DECRYPT_FAILED (the last is the single code for any authentication failure, including an unknown key id in a well-formed envelope). INVALID_KEY and INVALID_INPUT are additions.
- KEY_MISSING keeps the message that names `SECRET_KEY_FILE`: tasks.md 6.2 and design D4 require it, and it is fixed text with no I/O. U7 owns how the file is read; the box only names the source.
- AAD ambiguity: key ids are restricted to `[A-Za-z0-9_-]{1,32}` (no `.` or `|`), rejected with INVALID_KEY. The first two `|` then always delimit version and key id, so distinct (keyId, context) pairs cannot give equal AAD bytes. Context may contain `|` and `.`; it must be a non-empty string without unpaired surrogates (else they would collapse to U+FFFD and collide).
- Plaintext: UTF-8 string, at most 262144 bytes, no unpaired surrogates (INVALID_INPUT). Decrypted bytes are decoded with a fatal UTF-8 decoder that keeps a BOM, so a round trip is identical.
- Empty ciphertext segment is allowed (empty plaintext); all other segments must be non-empty and canonical. Envelope bound 1,048,576 characters, checked first.
- Context length is not bounded (the caller supplies it; it does no expensive work on a hostile party).
- SecretBoxError lives in secret-box/secret-box-error.ts so ports and the U7 bootstrap import it without touching infrastructure.
- In memory: private copies of the keys for the instance lifetime (no dispose). Per call, the UTF-8 input buffer and the decrypted-bytes buffer are zero-filled. Strings (plaintext argument, result, envelope) are immutable and cannot be wiped; nothing claims otherwise.

### Not protected

Key file plus database read together; memory disclosure or a compromised process; the process holds the key for its whole life; random source failure would reuse nonces (random 96-bit IVs also have a birthday bound near 2^32 messages per key, far above S0 use); no rotation tooling or re-encryption pass yet; the context must be chosen correctly by callers; no key-check value is defined in U6.

### Spec scenarios left for later units

Missing key at construction: covered here (KEY_MISSING). Malformed key: covered here (length); encoding and file parsing belong to U7. Key file excluded by version control: U7 task 7.5 (`*.key` rule from 1.4). Empty secret storage: U10 and U11.

### Size

633 hand-written added lines (source 192: box 148, error 18, ports 26; tests 441) against a 400 budget and a ~250 forecast. Not trimmed. Proposed split: PR A ports plus SecretBoxError plus construction, round-trip and format tests (about 250); PR B tamper table and error hygiene tests with strict parsing hardening (about 380).

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/api exec vitest run src/shared-kernel/secret-box`: 1 file, 88 tests passed |
| Runtime harness | N/A: crypto unit, no runtime boundary. Root `pnpm check` (318 API, 42 contracts tests) and `pnpm build` exit 0 |
| Rollback boundary | shared-kernel/secret-box/**; the tasks.md checkboxes |

## Batch 7: U7 Key file provider and bootstrap

Branch `feat/foundation-u7-key-provider`. Tasks 7.1 to 7.5 complete (5/5 of Phase 7; 34 of 61 overall). Mode: Strict TDD.
Commits: 5b6f84e (FileKeyProvider, tests, 7.1/7.2/7.5 checkboxes), 7bd529f (SecretKeyBootstrap, BootError, tests, 7.3/7.4 checkboxes). The two commits are separable along the contingency split named in tasks.md.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|---|---|---|---|---|---|---|---|
| 7.1/7.2 | apps/api/src/shared-kernel/secret-box/infrastructure/file-key-provider.int.test.ts | Integration (temp dir) | N/A (new) | Failed: Cannot find module './file-key-provider.js' | 63/63 passed | 3 umasks, exclusive create (existing file, second start, dangling symlink), 6 loose file modes, 5 loose dir modes, 24 malformed contents, symlink, directory in place of file, foreign owner, win32 branch | Reworded I/O error text; prettier; added a boundary fixture (4097 bytes) and an umask 0o477 test after two mutants survived |
| 7.3/7.4 | apps/api/src/shared-kernel/secret-box/secret-key-bootstrap.test.ts | Unit (in-memory store, real provider in temp dir) | N/A (new) | Failed: Cannot find module '../boot-error.js' | 18/18 passed | 6 D4 rows, 5 wrong-row variants, 3 unusable files x 2 row states, store read failure, row write failure then recovery, no exit and no console | None needed |
| 7.5 | N/A (verification) | N/A | N/A | N/A | git check-ignore matched the *.key rule, see below | N/A | N/A |

7.5 output: `.gitignore:6:*.key` for a non-existent `apps/api/secret.key` and for a non-existent `keys/secret.key`; both exit 0. No key file was created.

### Mutation checks (each restored and re-run green)

| Mutation | Result |
|---|---|
| Provider: remove the group/other mode check | 13 tests failed |
| Provider: exclusive create replaced by plain overwrite | 3 failed |
| Provider: remove symlink check and O_NOFOLLOW | 1 failed |
| Provider: remove directory permission check | 7 failed |
| Provider: remove owner check | 1 failed |
| Provider: remove file size limit | 1 failed (after adding the 4097-byte fixture; first survived) |
| Provider: remove post-create mode verification | 1 failed (after adding the umask 0o477 test; first survived) |
| Provider: accept non-canonical base64 | 2 failed |
| Bootstrap: generate a key even when a row exists | 3 failed |
| Bootstrap: overwrite the row on mismatch | 5 failed |
| Bootstrap: skip the constant comparison | 6 failed |
| Bootstrap: do not map KeyFileError to BootError | 4 failed |
| Bootstrap: rethrow non-SecretBoxError from decrypt | SURVIVED (equivalent: no public input makes decrypt throw another type; defensive) |

### Key file format

Plain text, ASCII, one key per line: key id, a colon, then standard base64 with padding of exactly 32 bytes (44 characters). A key id is 1 to 32 characters of letters, digits, underscore, hyphen. Exactly one trailing LF is allowed and optional. Rejected: empty file, blank lines, CR or CRLF, BOM, NUL, leading or trailing whitespace, any trailing garbage, base64url, missing padding, non-canonical trailing bits, a length other than 32 bytes, a repeated key id, a file over 4096 bytes. The last line is the active key (the design says "highest id"; with append-only rotation these coincide, so the file order decides and no id arithmetic is needed). Generation writes one line, id k1.

### Permission rules (POSIX)

Enforced on load: the file and its directory must have no group or other bits (any mode with mode & 077 set is refused, including read-only group access); both must be owned by the current user; the file must be a regular file and not a symlink (lstat, then open with O_NOFOLLOW, then fstat on the descriptor, then read from the descriptor); a file larger than 4096 bytes is refused. The directory check runs even when the key file does not exist. Enforced on generate: directory created 0700 (recursive, parents too); file created with open flag wx and mode 0600, so an existing path of any kind, a dangling symlink included, is never opened; the resulting mode is verified through the descriptor and a file this call created is deleted again if it is not owner-only and owner-readable.
Not enforced: ACLs and extended attributes, ancestors above the immediate directory, whether the directory is on a network or synced volume, hard links to the file, and on Windows everything mode-based (mode and owner checks are skipped with one injected warning naming the path; content validation, the symlink check and the exclusive create still apply, but Windows access control is not inspected or set, so no protection is claimed there).

### Bootstrap decision table as implemented

| Key file | Row for the active key | Result | Outcome or error |
|---|---|---|---|
| Absent | Absent | Generate k1, write the row | outcome generated (caller warns about backup) |
| Present | Absent | Write the row only | outcome recorded |
| Present | Present, opens to the constant | Nothing written | outcome verified |
| Present | Present, does not open or wrong constant or not an envelope | Fail, row and file untouched | BootError KEY_MISMATCH |
| Absent | Present (checked under id k1) | Fail, nothing created | BootError KEY_FILE_REQUIRED |
| Unusable (malformed, wrong length, duplicate, loose, symlink, foreign owner) | Any | Fail, file untouched, store untouched | BootError KEY_FILE_INVALID (message names path and reason) |

Row content: SecretBox encryption of a fixed public constant under the fixed context secret-key-check, nothing derived from the key outside the box. The bootstrap does not exit, log or call process.exit; store errors (database down) propagate unchanged and never lead to generation.

### Error codes

KeyFileError: KEY_FILE_PATH (relative path), KEY_FILE_EXISTS, KEY_FILE_UNSAFE, KEY_FILE_MALFORMED, KEY_FILE_IO. BootError (shared-kernel/boot-error.ts): KEY_FILE_INVALID, KEY_FILE_REQUIRED, KEY_MISMATCH. Later start-up steps add their own codes to BootErrorCode.

### Decisions where the design was silent

- Directory strictness: any group or other bit on the directory is refused, not only write bits. Consequence: a SECRET_KEY_FILE directly inside a 0755 directory is refused until the operator runs chmod 700 on it. The default location's directory is created 0700 so it is unaffected.
- Symlinks refused for the file; the directory path is followed (a symlinked directory is checked at its target).
- Owner must be the current user (POSIX). The uid source is injectable.
- Trailing newline: exactly one LF optional; anything else after the key line is malformed.
- Active key is the last line.
- Path must be absolute (KEY_FILE_PATH); expanding the home directory and resolving relative paths stays with U9. The default path is the function defaultKeyFilePath(home) with the home directory as a parameter; only production wiring will call it without an argument. No test or check ran against the real home directory.
- Warnings travel through an injected callback; the provider and the bootstrap never log.
- BootError lives in shared-kernel/boot-error.ts (generic, for later steps) rather than inside the bootstrap file.
- The key-check row is looked up under the active key id when a key file exists, and under k1 when it does not.
- FIRST_KEY_ID is exported from the provider so the bootstrap and generate agree.
- Read errors are reported as the system error code only (for example EACCES); the underlying error is never attached as a cause.

### Spec traceability (secret-protection scenarios)

| Scenario | Owner | Evidence |
|---|---|---|
| Round trip, non-deterministic output, hides plaintext, tampered, wrong key, malformed input | U6 | aes-gcm-secret-box.test.ts |
| Missing key (construction fails naming the source) | U6 for the box (KEY_MISSING); U7 for the file path: row 5 and KEY_FILE_REQUIRED test | secret-key-bootstrap.test.ts row 5 |
| Malformed key (wrong length, error without key value) | U6 for the box; U7 for the file: 24 malformed-content cases assert the message holds no key prefix | file-key-provider.int.test.ts |
| Key file excluded by version control | U7 task 7.5 | git check-ignore output above |
| Empty secret storage | U10 (baseline holds no credential) and U11 (only the key-check row exists) | not in U7 |
| Real database-backed four states | U11 | not in U7 |
| Boot wiring and exit code mapping | U13 | not in U7 |

### Limits

A 0600 file does not protect against root, backups that copy it, another process of the same user, a copied home directory or a synced folder. Between the directory check and the open there is a time-of-check to time-of-use window for the directory (the file itself is checked on the open descriptor). A second start that reads the file while the first is still writing it sees an incomplete file and fails closed (KEY_FILE_MALFORMED); it never overwrites. Generation draws the key with randomBytes(32); JavaScript strings holding the base64 text cannot be wiped, only the buffers are zero-filled. There is no rotation tooling and no re-encryption pass. With a rotated file (k1 and k2) only the active key's row is checked or written; a key file whose only id changed would record a new row without noticing the old data. The row write in the store is not atomic with the read (U11 must make it insert-only or conditional).

### Size

Hand-written added lines, 1,050 against a 400 budget and a ~340 forecast: provider commit 655 (source 282, tests 373), bootstrap commit 395 (BootError 16, source 88, tests 291). The provider alone is over budget; the split along the contingency line is already in two commits, but a further split of the provider (parsing and format tests versus permission and generation tests) is the only way to bring that PR under 400. Not trimmed.

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/api exec vitest run src/shared-kernel/secret-box`: 3 files, 169 tests passed |
| Runtime harness | Temp-dir key file: generated 0600 in a 0700 directory, loose modes rejected (all inside the tests). Root `pnpm install --frozen-lockfile`, `pnpm check` (399 API, 42 contracts tests) and `pnpm build` exit 0 |
| Rollback boundary | shared-kernel/boot-error.ts, shared-kernel/secret-box/infrastructure/file-key-provider*, shared-kernel/secret-box/secret-key-bootstrap*; the tasks.md checkboxes |

## Batch 8: U8 Env schema

Branch `feat/foundation-u8-env-schema`. Tasks 8.1 and 8.2 complete (2/2 of Phase 8; 36 of 61 overall). Mode: Strict TDD.
Commits: 331faf4 (core schema: defaults, strict ports, enums, aggregate error, zod dependency), 4f8dd78 (loopback host rule, opt-in flag, origin allow-list, task checkboxes). The two commits are separable.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|---|---|---|---|---|---|---|---|
| 8.1/8.2 core | apps/api/src/config/env.schema.test.ts | Unit | N/A (new) | Failed: Cannot find module './env.schema.js' | 78/78 passed (two test-side slips fixed first: a key-name assertion and an error-wording regex) | 4 ports valid, 17 invalid, 5 NODE_ENV, 6 LOG_LEVEL, 5 and 8 API versions, busy-timeout 3 and 9, path 2 variables, unknown keys, frozen, no mutation, aggregate list, seeded-value hygiene | Prettier only |
| 8.1/8.2 hosts, flag, origins | same file | Unit | 78/78 existing | 91 failed, 120 passed (211) | 211/211 passed first run | 19 flag near misses (x3 checks), 8 loopback hosts, 15 non-loopback hosts, 18 malformed hosts, 5 + 31 origins, trim, dedupe, wildcard in a list, 12-variable hygiene, cross-rule aggregate | Prettier only |

### Mutation checks (each restored, re-run green 211/211)

| Mutation | Result |
|---|---|
| Non-loopback check always passes | 36 tests failed |
| Any truthy string opts in | 40 failed |
| Wildcard origin allowed (the explicit star check removed) | 1 failed (the wildcard-host origin; a bare star already fails URL parsing) |
| Opt-in flag case-insensitive | 4 failed |
| 0.0.0.0 treated as loopback | 22 failed |
| Any IPv6 treated as loopback | 3 failed |
| Origin canonical-equality check removed | 12 failed |
| No de-duplication | 1 failed |
| No trimming | 2 failed |
| Any hostname containing localhost is loopback | 4 failed |
| Any host starting with 127. is loopback | 4 failed |
| Error echoes the input value | 2 failed |

### Variables as implemented

All twelve variables from D6, same names and defaults, no addition and no removal. Defaults are applied by running the default string through the same schema.

| Name | Type | Default | Rule |
|---|---|---|---|
| NODE_ENV | development, test, production | development | exact, case-sensitive |
| API_HOST | string, bind-ready | 127.0.0.1 | valid IPv4, IPv6 or hostname; non-loopback needs the opt-in |
| API_PORT | integer | 3000 | plain digits, 1 to 65535, no sign, no leading zero, no padding, no float, hex or exponent |
| WEB_HOST | string, bind-ready | 127.0.0.1 | same as API_HOST |
| WEB_PORT | integer | 5173 | same as API_PORT |
| ALLOW_NON_LOOPBACK | boolean | false | exactly true or false; anything else is an error |
| ALLOWED_ORIGINS | list of origins | http://127.0.0.1:WEB_PORT and http://localhost:WEB_PORT | canonical http or https origins, comma separated |
| SHOPIFY_API_VERSION | string | 2026-10 | four digits, dash, 01, 04, 07 or 10 |
| DATA_DIR | string | ./data | non-empty, no NUL; resolution is U9 |
| SECRET_KEY_FILE | string | the key file under the hidden application folder in the home directory | non-empty, no NUL; expansion is U9; no variable carries the key itself |
| SQLITE_BUSY_TIMEOUT_MS | integer | 5000 | positive plain digits, at most 2147483647 |
| LOG_LEVEL | error, warn, info, debug | info | same domain as the logger, enforced by a Record keyed on the logger's LogLevel type |

### Rules as implemented

- Loopback: IPv4 inside 127.0.0.0/8 (strict dotted quad), IPv6 equal to ::1 in any spelling (checked through the WHATWG URL normaliser), and the name localhost in any letter case. Brackets are accepted around IPv6 and removed from the returned host, because listen() wants the bare form. Non-loopback but valid: 0.0.0.0, ::, IPv4-mapped loopback, any other address, any other name (sub.localhost, localhost with a trailing dot, look-alike names, names that embed an address). Malformed (error naming the variable, even with the opt-in): empty, padded, with a port or scheme or path, short IPv4 such as 127.1, leading-zero IPv4, all-numeric last label, bad label characters or length, unbalanced brackets, bracketed IPv4.
- localhost decision: the design lists it as loopback, so it is accepted. It is resolved by the system resolver and could be remapped to another address, which a pure check cannot see; accepted residual risk, flagged for U13, which can verify the bound address.
- Origins: each entry must parse as a URL, use http or https, and equal its own canonical origin string. That rejects wildcards, paths, a trailing slash, query, fragment, credentials, upper-case scheme or host, default ports written out, non-ASCII hosts and non-URLs in one rule; a star anywhere is also rejected explicitly. Spaces and tabs around entries are trimmed; any other whitespace is an error. Empty entries (a stray comma, an empty value) are errors. Exact duplicates are removed, first occurrence wins, order kept. The derived default uses the parsed WEB_PORT and is skipped silently when WEB_PORT is itself invalid (that variable is already reported).
- Unknown variables: ignored. The schema reads only its twelve names, case-sensitive, so the hundreds of unrelated variables of a real environment never matter, and a typo such as api_port is silently the default. Strict key rejection was not applied because it would break boot on any real environment; U9 may add a warning for near-miss names if wanted.
- Error: ConfigError (code INVALID_CONFIG) with an issues list of variable plus fixed problem text. The message is "Invalid configuration:" followed by one line per issue, "- NAME: problem", in D6 order. All invalid variables are reported in one throw. Values are never echoed for any variable: the design says never a value, and no variable was singled out. Tested on message, stack, JSON, String(), and issues for all twelve names with a seeded odd value including a NUL byte.
- Result: Object.freeze on the config and on the origin list; readonly typed; ports, booleans and the timeout are numbers and booleans. parseEnv is pure and does not mutate its input (tested with a frozen input).

### Decisions where the design was silent or differed

- Design D7 says "the literal true; anything else is false". The task for this unit required anything unlisted to be an error rather than a silent false. Implemented as the task says: true and false are the only accepted forms, everything else (TRUE, 1, yes, padded, empty) is an error. Neither reading can turn the opt-in on by accident. Difference from D7 wording, safe direction, not a spec conflict.
- Empty string is an error for every variable (not treated as unset). Consequence for U9: .env.example must use the default values, or leave lines commented out, instead of empty values, otherwise copying the sample verbatim fails validation. Only an absent variable (undefined) takes the default.
- When ALLOW_NON_LOOPBACK is itself invalid, the host check treats the opt-in as off, so both variables are reported.
- Host check is judged per variable (API_HOST and WEB_HOST each get their own issue).
- Returned apiHost and webHost are normalised (lower-case, no brackets).
- SQLITE_BUSY_TIMEOUT_MS has an upper bound of 2147483647 (the SQLite integer limit); the design only says positive integer.
- DATA_DIR and SECRET_KEY_FILE: shape only (non-empty, no NUL byte).
- Dependency: zod 4.6.7 added to apps/api (same pin as contracts); lockfile +3 lines. zod is used per field with fixed custom messages, and issues are aggregated by the module itself, because cross-field rules (host versus opt-in, origin default versus port) need partial results when other fields fail.
- The schema imports only the LogLevel type from the shared kernel logger and node:net for address syntax checks (pure, no I/O). No NestJS import.

### Spec traceability (U8)

| Scenario | Test (env.schema.test.ts) |
|---|---|
| runtime-configuration: Valid configuration | describe defaults: all twelve filled; explicit values parse into typed fields |
| runtime-configuration: Malformed port | describe ports: rejects abc and 16 other values naming API_PORT and WEB_PORT |
| runtime-configuration: Default version | describe defaults: pinned constant and parsed default |
| runtime-configuration: Malformed version | describe SHOPIFY_API_VERSION: rejects latest and others naming the variable |
| runtime-configuration: Defaults (loopback, port) | describe defaults |
| runtime-configuration: error never carries a value | describe aggregate failure: seeded value absent from message, stack, JSON (8 and 12 variables) |
| runtime-configuration: Sample is complete, Real env ignored | U9 (task 9.2) |
| runtime-configuration: abort at startup, exit path | U9 loader and U13 boot |
| local-security-baseline: Default bind | describe defaults; loopback hosts accepted without opt-in |
| local-security-baseline: Non-loopback without opt-in | describe loopback hosts: 15 hosts refused naming the variable and the opt-in |
| local-security-baseline: Non-loopback with opt-in | describe loopback hosts: accepted once the opt-in is the literal true; ALLOW_NON_LOOPBACK near misses never open a bind |
| local-security-baseline: allow-list shape (no wildcard, exact origins) | describe ALLOWED_ORIGINS |
| local-security-baseline: preflight, origin guard scenarios, redaction | U12 and U13 (CORS and guard are runtime), U4 and U5 (redaction) |
| bind actually listens on loopback, non_loopback_bind warn event | U13 |

### Size

Hand-written added lines, 760 against a 400 budget and a ~230 forecast: source 262, tests 495, manifest 3. By commit: core commit 400 (source 157, tests 240, manifest 3), host and origin commit 386 (source 131, tests 255). Not trimmed. Each commit is within budget; the split is the cheapest honest way to land it, otherwise a size exception is needed.

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/api exec vitest run src/config`: 1 file, 211 tests passed |
| Runtime harness | N/A: pure schema, no runtime boundary. Root `pnpm install --frozen-lockfile`, `pnpm check` (610 API, 42 contracts tests) and `pnpm build` exit 0 |
| Rollback boundary | apps/api/src/config/env.schema*, the zod line in apps/api/package.json and its lockfile delta; the tasks.md checkboxes |

## Batch 9: U9 Loader, paths, env.example

Branch `feat/foundation-u9-config-loader`. Tasks 9.1 to 9.4 complete (4/4 of Phase 9; 40 of 61 overall). Mode: Strict TDD.
Commits (separable, each green on its own): d6935b5 (path resolution), 49d1f97 (loader and env file reading), third commit (ConfigModule, env.example, sample test, task checkboxes, this file; hash in the git log).

### Task 9.1 finding (design item 6)

Checked on the installed Node 24.21.0 by running it, not from memory.

- `process.loadEnvFile(path)` exists but copies the file into `process.env` (global mutation) and throws on a missing file. The CLI flag `--env-file` is also global and cannot be injected. Both are unsuitable for a loader that must be testable and side-effect free.
- `util.parseEnv(content)` exists, takes the file content as a string and returns a plain object. Verified: it does NOT touch `process.env` (a probe key stayed unset), it tolerates quotes, `export`, comments, CRLF, and it throws only for a non-string argument. It is the API used (`import { parseEnv } from 'node:util'`, aliased in the loader to avoid the schema function of the same name).
- Stability: the installed Node does not ship its API documentation, so the badge was not read from the doc page. The installed CHANGELOG records, in 24.10.0, the commit "doc: mark .env files support as stable" (nodejs PR 59925); `util.parseEnv` is part of that feature. Treat it as stable from 24.10.0. Risk: the repository floor is `engines.node >=24`, so 24.0 to 24.9 still had it flagged as in development; the function itself behaved the same in the probe, and `.node-version` / the fnm install pin 24.21.0.
- Fallback from the task (own file reader) was not needed for parsing; reading the file is a plain `readFileSync` in the loader because `parseEnv` takes content, not a path (also gives typed errors).
- Parser behaviour that shaped the design: it is lenient. A line without an equals sign, or a line such as `API_PORT 3000`, is silently dropped, so a typo would silently fall back to the default. The loader therefore checks each line first (blank, comment, or `[export] NAME=value`) and fails with the line number. Side effect: multi-line quoted values are not supported (no variable needs one). Also, the parser returns lower-case keys after upper-case ones, so near-miss warnings are sorted to be deterministic.
- Note for U10 (Prisma config): `prisma.config.ts` must NOT depend on the API's `loadConfig` being called first, and must not call `process.loadEnvFile`. Prisma commands (`db:generate`, `db:migrate`) run as separate processes outside the API boot, so the Prisma config file has to compute `DATA_DIR` itself. It should call `loadConfig()` (or a small subset) from `apps/api/src/config/load-config.ts`, which returns the same absolute `dataDir`, and the database URL is then `file:` plus the join of `dataDir` and `importer.db`. Because `loadConfig` does not mutate `process.env`, Prisma's own variable handling is unaffected. If the config file is loaded by Prisma's TypeScript loader without the `.js` extension mapping, import from the compiled or `.ts` path accordingly (verify in 10.1). `loadConfig()` validates all twelve variables, so a bad unrelated variable also fails `db:migrate`; this is intended (one source of truth). `findWorkspaceRoot` walks up from the module's own folder, so it does not depend on where Prisma is started.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|---|---|---|---|---|---|---|---|
| 9.2/9.3 paths | apps/api/src/config/paths.test.ts | Unit (temp dir only for the root search) | N/A (new) | Failed: Failed to resolve import './paths.js' | 32/32 passed first run | 5 relative, cwd independence, parent escape, 2 absolute, 4 shorthand, 4 not-leading, 6 tilde-name forms, 2 unusable homes, NUL, empty, bad root, 3 root-search cases, default start | Lint only: removed a needless async from one test |
| 9.2/9.3 loader | apps/api/src/config/load-config.test.ts | Integration (temp dir env files, injected env, root and home) | 211 schema tests green | Failed: Cannot find module './load-config.js' | 32/32, one test-side slip fixed (parser key order), then 33/33 after the distance-two case | defaults, frozen, missing file, default .env, relative envFile, 2 parse cases, 4 precedence cases, no mutation, 5 path cases, 2 invalid-config cases, 5 malformed-file kinds plus line number, bad UTF-8, size edge both sides, directory, permission denied, near-miss warn and quiet and substitution and distance two | Types: file values typed as RawEnv; a Proxy type argument instead of an assertion |
| 9.2/9.3 module | apps/api/src/config/config.module.test.ts | Integration (Nest application context) | N/A (new) | Failed: Cannot find module './config.module.js' | 3/3 passed after one fix (see Issues) | token resolves, explicit-@Inject consumer gets the same frozen object, failed config rejects with ConfigError naming only API_PORT | Typed the token lookup (lint) |
| 9.2/9.4 sample | apps/api/src/config/env-example.test.ts | Integration (reads the committed sample, git check-ignore) | N/A (new) | Failed: ENOENT for the sample file | 9/9 passed | all 12 names present both ways, each once, active lines equal defaults, optional lines valid, no empty values, works as an env file with no warning, no secret or machine path, .env ignored, sample not ignored | None needed |

### Mutation checks (each restored, re-run green)

| Mutation | Result |
|---|---|
| Env file overrides the real environment (reverse precedence) | 3 failed |
| Undefined environment entry overwrites a file value | 1 failed |
| Relative paths against the working directory (paths.ts) | 12 failed |
| Relative paths against the working directory (loader context) | 4 failed |
| Home shorthand expanded anywhere in the string | 4 failed |
| Another account's shorthand (tilde-name) expanded | 6 failed |
| NUL check removed | 1 failed |
| Env-file error echoes the offending line | 3 failed (5 malformed kinds each check the seed) |
| Missing env file treated as an error | 8 failed |
| Env file also copied into process.env | 1 failed |
| Near-miss check flags anything (distance not enforced) | 3 failed |
| Sample: variable dropped, extra variable added, empty value, default drifted, absolute path added | each failed 1 to 4 sample tests |
| Module: export removed, config loaded with a different environment | 3 failed |

### Decisions where the design was silent or differed

- Sample file name: `env.example` with no leading dot, as decided earlier. design.md and the runtime-configuration spec still say the dotted name and were not edited. Reason: the user's permissions deny the Read, Write and Edit tools on dotted env files.
- Sample content (deviation from task 9.4 and the spec wording "placeholder or empty value"): every variable carries its real default value, never an empty one, because the schema rejects empty strings. ALLOWED_ORIGINS is the one commented line, because its default is derived from WEB_PORT and an active copy would go stale when the port changes. Copying the file unchanged to the real env file validates (tested). No secret exists to placeholder: the key is a file, not a variable.
- Precedence: real environment overrides the env file (the design is silent; this is the common convention). An environment entry that is undefined does not override; an empty string does override and then fails validation like any empty value.
- Env file location: default is the file named .env in the workspace root; the loader takes `envFile`, `workspaceRoot`, `home`, `env` and `warn` as injected options. Production calls `loadConfig()` with none of them. The only read of the process environment is the `options.env ?? process.env` default in load-config.ts, inside the folder the lint rules allow.
- Workspace root: nearest folder above the loader module holding the marker file pnpm-workspace.yaml (`findWorkspaceRoot`, start folder injectable). It works from source and from dist and never depends on the working directory. Not found gives a typed PathError.
- Relative paths resolve against that root, never the current directory. Parent segments are allowed to leave the workspace (an operator may point the data folder elsewhere); the design does not forbid it. Result is normalised and absolute.
- Home shorthand: only a leading tilde alone or followed by a separator. Any other leading tilde (the tilde-name form, or a name that merely starts with a tilde) is rejected with the variable named, and the message suggests a dot-slash prefix for a literal folder. Tilde elsewhere in the string is literal. A home directory that is empty or not absolute is an error only when the shorthand is used.
- The loader creates no directory or file and never opens the key file. Creating DATA_DIR belongs to the persistence unit (U10); creating the key folder belongs to the key provider (U7).
- Errors: schema failures surface as the existing ConfigError unchanged. Path failures are turned into ConfigError issues (variable plus fixed text, no value). Env-file failures are a new typed EnvFileError (codes ENV_FILE_PATH, ENV_FILE_UNREADABLE, ENV_FILE_MALFORMED) whose message holds the file path and a reason (an errno code, a line number, a size or encoding fact), never content, and no cause. The loader never exits and never logs; U13 maps these errors to a non-zero exit.
- Env file limits: 64 KiB, valid UTF-8, no NUL, strict line grammar (see 9.1). A permission failure on the file is an error (not treated as absent); only ENOENT means absent.
- Near-miss warnings (optional item): implemented. For names found in the env FILE only (not in the real environment, which holds hundreds of unrelated names), a name that is a case change or one edit away from a schema variable produces one fixed-text hint through the injected `warn`, naming the file, the wrong name and the likely name, never a value. Exact names, unrelated names and two-edit names are quiet. The known-name list is read from the schema itself by running it against a recording Proxy (`schemaVariableNames`), so it cannot drift. Cost: about 25 source lines and 40 test lines.
- Return type: `AppConfig` is an alias of the schema's `EnvConfig`; the two path fields are absolute after loading. The object is frozen.
- ConfigModule: `ConfigModule.forRoot(options?)` is a dynamic, non-global module. It loads once at module build and exports the result under the symbol token `APP_CONFIG`; consumers use `@Inject(APP_CONFIG)` explicitly. It is not yet imported by AppModule (U13 owns boot wiring). No @nestjs/testing was needed: the test uses `NestFactory.createApplicationContext`, as the U2 spike did. No new dependency, lockfile unchanged.
- Existing code left alone: env.schema.ts, eslint.config.js, .gitignore, .prettierignore. No U9 test exposed a schema defect.

### Issues found

- Nest aborts the process on a failed initialisation: a factory that throws makes `NestFactory.create*` call `process.abort()` unless `abortOnError: false` is passed. The first run of the module failure test crashed the worker (and left two temp folders, removed by hand). The test passes `abortOnError: false`. For U13: call `loadConfig` BEFORE `NestFactory.create` (as the design's boot diagram does) and map errors there; do not rely on Nest to surface a configuration error, and set `abortOnError: false` for later failures so BootError can drive the exit code.
- The ignore rule in .gitignore is the exact name `.env`. Names such as .env.local or .env.production are NOT ignored (verified with git check-ignore). The loader reads only the file named .env, so they are not loaded, but an operator who creates one would see it in git status. Suggested follow-up (not done, outside U9 scope): add a `.env.*` rule; the sample env.example has no leading dot and would be unaffected.
- design.md still says `.env.example`; the spec says "environment sample". Both are unedited, as decided earlier.

### Spec traceability (runtime-configuration)

| Scenario | Owner | Evidence |
|---|---|---|
| Valid configuration | U8 schema, U9 loader | env.schema.test.ts defaults; load-config.test.ts "without a file" and "env file contents"; config.module.test.ts |
| Malformed port (aborts, names the variable) | U8 for the rule; U9 for the loader path; U13 for the actual abort and exit code | env.schema.test.ts ports; load-config.test.ts "invalid configuration" (API_PORT from file and environment, value absent, no process.exit) |
| Default version, Malformed version | U8 | env.schema.test.ts |
| Defaults (loopback, port) | U8 | env.schema.test.ts; load-config.test.ts defaults |
| Sample is complete | U9 | env-example.test.ts "lists every variable the schema reads" (both directions) |
| Real env ignored | U9 (rule from U1) | env-example.test.ts "ignores the real env file" (git check-ignore on the name; also run by hand, see below) |
| Secret-free sample (requirement text) | U9 | env-example.test.ts "holds no secret and no machine-specific path or account" |
| Error never carries a secret value | U8 and U9 | load-config.test.ts seeded values from file and from environment; EnvFileError tests assert file content absent |
| Startup abort before accepting requests (process exit) | U13 | not in U9: the loader only throws |

git check-ignore, run against names that do not exist on disk (nothing was created): `git check-ignore -v .env` prints `.gitignore:5:.env` and exits 0; `git check-ignore -v env.example` prints nothing and exits 1 (the sample is tracked); `git check-ignore -v .env.local` prints nothing and exits 1.

### Limits

Reading a path is not creating it: a configured DATA_DIR or SECRET_KEY_FILE that does not exist is accepted here; the persistence unit and the key provider check them when they use them. The permission-denied test is skipped when running as root or on Windows. Symlinks in the env file path are followed (the file is the operator's own configuration, not a secret store; the key file has stricter rules in U7). A real environment variable cannot be unset by the file. The line grammar rejects names with dots or dashes in the file even though the platform parser would accept them.

### Size

Hand-written added lines, 1,008 in total against a 400 budget and a ~185 forecast: source 288 (paths 90, loader 177, module 21), tests 683 (paths 158, loader 337, module 86, sample 102), sample file 37. By commit: paths commit 248 (source 90, tests 158), loader commit 514 (source 177, tests 337), module and sample commit 246 plus tasks and progress notes. Not trimmed. Only the third commit is under 400 on its own; the loader commit is over mostly because of the env-file error matrix and precedence tests. A further split of the loader commit is possible along near-miss warnings (about 35 source plus 50 test lines) and the env-file problem matrix (about 70 test lines).

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/api exec vitest run src/config`: 5 files, 288 tests passed |
| Runtime harness | `loadConfig` against env files written by the tests into fresh temp directories (default .env name, a custom name, missing, directory, unreadable, malformed), and the sample used as an env file. Root `pnpm install --frozen-lockfile`, `pnpm check` (687 API, 42 contracts tests, 2 skipped) and `pnpm build` exit 0 |
| Rollback boundary | apps/api/src/config/paths*, load-config*, config.module*, env-example.test.ts, and env.example at the repository root; the tasks.md checkboxes |

## Batch 10: U10 Persistence core and migration

Branch `feat/foundation-u10-persistence`. Tasks 10.1 to 10.4 complete (4/4 of Phase 10; 44 of 61 overall). Mode: Strict TDD.
Commits: b1c21c6 (`.env.*` ignore line), f5c9508 (Prisma dependencies, schema, config file, scripts, baseline migration, migration test), 1f022b0 (data directory and file created owner-only), 59885b4 (connection settings check), and a fifth commit (PrismaService, PersistenceModule, tests, task checkboxes, this file; hash in the git log).

Resolved versions (exact pins): prisma 7.10.0, @prisma/client 7.10.0 (matches @prisma/adapter-better-sqlite3 7.10.0; the npm latest tag is 8.0.0-rc.22 and was not installed). better-sqlite3 stays 12.11.1.

### Verification of the three design assumptions (task 10.1)

| Item | Verdict | Evidence |
|---|---|---|
| 3: generated client under the strict flags | PASS, by the generator's own exclusion, no fallback applied | The generated files start with a ts-nocheck and eslint-disable header, so `tsc` passes with the strict base flags unchanged and ESLint already ignores the folder (`globalIgnores`) and Prettier too (`.prettierignore`). With the ts-nocheck line stripped from a scratch copy, `tsc` reports 4 errors, all about missing WebAssembly lib types and untyped wasm modules in the runtime import; none comes from `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` or NodeNext. Hand-written code calls the client under the strict flags without errors. The client type is opaque to the compiler, so the persistence code and tests describe the few members they touch. |
| 4: pragmas, busy timeout, one connection | PASS | Read from the installed adapter's declaration and source: the adapter takes the better-sqlite3 Options plus `url`; its `timeout` option is the busy timeout. There is no pragma option. `connect()` of the factory builds exactly one `new Database(...)` per call and the adapter guards transactions with a mutex. WAL and foreign keys are therefore statements through the client, and they persist because the connection is single (test: adapter `connect` called once across connect twice, 8 parallel reads and a transaction; foreign_keys reads 1 every time; busy_timeout reads back the configured value). |
| 5: generate, deploy, no implicit generation | PASS | `prisma generate` and `prisma migrate deploy` both load `prisma.config.ts` (it imports the project's ESM TypeScript with a `.js` specifier and it works under Prisma's config loader, no fallback needed). With the generated folder deleted, `migrate deploy` applied the baseline and did NOT recreate the folder. A second deploy printed "No pending migrations to apply" and exited 0. `generate` with an absent data directory did not create it. Prisma 7's `migrate dev` does not generate either. |

### Install and scripts

- Prisma needed `allowBuilds` for `@prisma/engines` (set to true; its postinstall downloaded the schema-engine binary for darwin-arm64, 26 MB, into the engines package folder). `prisma` itself is set to false: its preinstall only checks the Node version, which the CLI repeats at every start. Nothing else was approved.
- Generation is triggered by: `pretypecheck`, `pretest`, `prebuild` and `predev` in `@importer/api` (so root `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm dev`, and therefore `pnpm check`) and by the root `prelint` (so `pnpm lint` on its own works after a fresh clone). `pnpm db:generate` runs it explicitly. Calling vitest or eslint directly does not generate.
- `pnpm db:migrate` is `prisma migrate deploy` in the API package; the API never migrates at boot. The migrate commands create the data directory (0700) and the database file (0600) first, through the config file (only when the Prisma sub-command is migrate).
- Baseline migration command (run once, against a temporary data directory with the home directory also pointed into a temp folder): `prisma migrate dev --name baseline` in the API package, with DATA_DIR set explicitly. Output: migration 20261013180211_baseline and migration_lock.toml, committed untouched.

### Table definition

`CREATE TABLE "app_setting" ("key" TEXT NOT NULL PRIMARY KEY, "value" TEXT NOT NULL, "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`. Prisma model AppSetting with `@@map("app_setting")` and `updatedAt @default(now()) @updatedAt @map("updated_at")`. No other table, column or index.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|---|---|---|---|---|---|---|---|
| 10.2/10.3 migration | apps/api/src/persistence/baseline-migration.int.test.ts | Integration (real Prisma CLI in a temp dir) | N/A (new) | Failed: Failed to resolve import './database-location.js'; then 3 failed (ENOENT for the migrations folder, app_setting missing) | 5/5 after generating the migration; 6/6 after the permissions test | committed SQL checksum equals the recorded checksum, second deploy no-op with identical history, exact table and column list, location equals loader result, directory 0700 and file 0600 | Prettier; added a row-count assertion because the no-op test passed vacuously at RED |
| 10.3/10.4 location | apps/api/src/persistence/database-location.int.test.ts | Integration (temp dir) | N/A (new) | Failed: Cannot find module './persistence-error.js' | 5/5 | umask 0 creation, untouched content plus tighten 0644 to 0600, loose directory refused, path is a file, read-only parent (skipped as root) | None needed |
| 10.3/10.4 settings | apps/api/src/persistence/connection-settings.test.ts | Unit | N/A (new) | Failed: Cannot find module './connection-settings.js' | 8/8 | 2 integer types, 6 mismatch cases, all-wrong list | Typed the parameter as RawConnectionSettings |
| 10.3/10.4 service and module | apps/api/src/persistence/prisma.service.int.test.ts | Integration (temp dir, Nest context) | N/A (new) | Failed: Cannot find module './persistence.module.js' | 33/33, then 34/34 | create-then-refuse as one scenario, zero rows, WAL plus busy timeout 1234 and 777 plus foreign keys, other handle sees WAL, read/write/update/transaction, one adapter connect, DATA_DIR unusable, corrupt file, WAL read-back failure, reachable before/true/false after removal/false after replacement, disconnect twice with no WAL leftovers, 0700/0600 on directory, database and WAL files, module build and shutdown | Renamed the pragma helper; `$queryRawUnsafe` given an explicit type argument (lint); the module test replaced a lint-rejected cast |

### Mutation checks (each restored, suite re-run green 34/34)

| Mutation | Result |
|---|---|
| Skip setting WAL | 11 failed (boot refuses; WAL test fails) |
| Skip the busy timeout (driver default 5000 used) | 11 failed |
| Serve without the baseline check | 1 failed (create-then-refuse scenario) |
| Prisma config points at a different location than the loader | 3 failed |
| Skip the settings verification call | 1 failed (read-back mismatch test); first survived until that test was added |
| Verification ignores journal_mode | 3 failed |
| isReachable ignores file identity | 1 failed (replaced file) |
| No error mapping on driver failure | 1 failed (corrupt file) |
| disconnect does nothing / module shutdown hook removed | 1 failed each |
| mkdir without mode 0700 | 19 failed |
| Directory-mode check removed / tighten removed | 1 failed each |
| Config file does not prepare the directory on migrate | 1 failed (0700/0600 after db:migrate) |
| SURVIVED: skip `PRAGMA foreign_keys = ON` | Equivalent mutant: better-sqlite3 is built with foreign keys on, so the read-back is 1 either way; the statement and the read-back stay as defence in depth |
| SURVIVED: open the file without mode 0600 | Equivalent mutant in outcome: the follow-up tighten step still yields 0600; the explicit mode only closes a brief window after creation |

### Decisions where the design was silent or differed

- PrismaService is a framework-free plain class. The lint rules would allow Nest in `persistence/` (only the shared kernel and `*.port.ts` files are restricted), so this was a choice, not a lint constraint: a plain class constructed by a factory provider is testable without Nest and matches the ordered-boot design. Shutdown is driven by `PersistenceModule.onApplicationShutdown`. Wiring: `PersistenceModule.forRoot(configModule)` takes the same `ConfigModule.forRoot(...)` the app imports; token `PRISMA_SERVICE`. Building the module does not connect.
- Typed error: a new `PersistenceError` (DATA_DIR_UNUSABLE, MIGRATION_REQUIRED, DATABASE_SETUP_FAILED) instead of extending U7's `BootErrorCode`, which kept earlier units' files untouched. U13 maps it to exit 1, like ConfigError and EnvFileError.
- Who creates the directory: the persistence layer (`prepareDatabaseFile`), called by `PrismaService.connect` and by the config file for migrate commands. Directory and parents 0700, file 0600, independent of the umask. An existing directory with any group or other bit is refused with a chmod 700 hint (same stance as the key directory); an existing database file wider than 0600 is tightened. SQLite gives `-wal` and `-shm` the mode of the database file (observed 0600 in the test), and the directory mode covers them regardless. Nothing is checked on Windows.
- Foreign keys: the design says set and read back; both done. Journal mode must be wal, busy timeout and foreign keys must read back as configured, else DATABASE_SETUP_FAILED.
- `isReachable()` also compares the file's device and inode with those seen at connect: on POSIX an open handle keeps working after the file is deleted, so a bare SELECT 1 would report a removed database as up.
- The migrate-only data directory preparation in `prisma.config.ts` reads `process.argv` for the word migrate. It is a small, tested hack, chosen because Prisma would otherwise create the folder 0755 and file 0644 and the service would then refuse the folder.
- `tsconfig.json` of the API now includes `prisma.config.ts` (so the type-aware lint project service can see it); the build config still compiles `src` only.
- The generated client path is the one `.gitignore` already listed; it stays untracked. Prisma's update notice appears on stdout (network check); `CHECKPOINT_DISABLE=1` and `PRISMA_HIDE_UPDATE_MESSAGE=1` silence it and the tests set both.
- The migration test runs the real Prisma CLI as a child process with an explicit minimal environment and the home directory inside the sandbox. Service tests apply the committed SQL with the driver directly (faster); the CLI path is covered once in the migration test.

### Spec traceability (persistence-baseline and secret-protection)

| Scenario | Test |
|---|---|
| Local access: Connect to configured file (creates if absent) | prisma.service.int.test.ts "creates the database file when absent, then refuses..." and "connects to a migrated database..."; baseline-migration.int.test.ts "puts the database where the application configuration says" |
| Local access: Unwritable path (names the path setting) | database-location.int.test.ts (file in place of directory, read-only parent, loose directory); prisma.service.int.test.ts "names DATA_DIR and leaves nothing behind" |
| Baseline migration: Apply to empty database | baseline-migration.int.test.ts "applies the committed SQL to an empty database and records it" |
| Baseline migration: Re-apply | baseline-migration.int.test.ts "changes nothing and exits 0 when applied again" |
| Readiness: Reachable | prisma.service.int.test.ts "connects to a migrated database..." and "reports false..." (true before removal) |
| Readiness: Unreachable (removed file, no throw) | prisma.service.int.test.ts "reports false, without throwing, once the database file has been removed" and "replaced" |
| Readiness consumed by /health | U14 |
| secret-protection: Empty secret storage (no credential persisted) | U10 part: zero rows in a migrated database (service test, migration test); the key-check-row-only half is U11 |
| Key-check store, four key states | U11 |
| Boot ordering, exit code mapping | U13 |

### Size

Hand-written added plus deleted lines, 977 in total against a 400 budget and a ~290 forecast: .gitignore 1; Prisma dependencies, schema, config, scripts and migration test 221 (source and config 70, test 151); data directory 182 (source 59, tests 123); connection settings 94 (source 41, tests 53); service and module 479 (source 159, test 320). Generated, counted separately: pnpm-lock.yaml 1,053 added and 38 removed, migration SQL 6, migration_lock.toml 3. Not trimmed. Only the service and module commit is over 400 on its own; the test file (320 lines) is most of it.

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/api exec vitest run src/persistence`: 5 files, 34 tests passed |
| Runtime harness | Real `prisma migrate deploy` twice on a temp DATA_DIR (second: no pending migrations, exit 0), WAL read back, built output (`node` on dist) refusing an unmigrated temp database with the typed error; root `pnpm install --frozen-lockfile`, `pnpm check` (721 tests) and `pnpm build` exit 0 |
| Rollback boundary | apps/api/prisma/**, apps/api/prisma.config.ts, apps/api/src/persistence/**, the script and dependency lines in both package manifests, the lockfile delta, the allowBuilds lines for prisma, the prisma.config.ts line in apps/api tsconfig.json, the .gitignore line is separate |

## Batch 11: U11 Key-check store

Branch `feat/foundation-u11-key-check-store`. Tasks 11.1 and 11.2 complete (2/2 of Phase 11; 46 of 65 overall, as counted by native SDD status). Implementation and local verification complete; delivery is pending. Next unit: U12. Mode: Strict TDD.

`PrismaKeyCheckStore` implements the kernel's `KeyCheckStore` port using the connected `PrismaService`. It stores envelopes under `secret-key-check:<keyId>` in `app_setting`, keeping the key-check namespace separate from unrelated settings. An absent row returns null; database failures propagate.

Writes are insert-only. The primary key rejects duplicate and competing inserts with Prisma's P2002 error, leaving the original envelope and timestamp untouched. This closes the read/write race identified in Batch 7: a losing bootstrap fails rather than accepting a competing check or replacing it. It does not retry or silently ignore the conflict.

`PersistenceModule` exports `KEY_CHECK_STORE` and constructs the store from the same `PRISMA_SERVICE` provider. Module creation remains lazy; ordered connection and boot error mapping belong to U13. The module integration test injects both tokens into an importing module and observes shutdown through the store.

### TDD evidence

#### TDD Cycle Evidence

| Task | RED (tests first) | GREEN | REFACTOR |
|---|---|---|---|
| 11.1 | Integration suite written first; missing adapter import failed, then a no-op adapter produced 10 failed and 1 passed | All four key/database states passed against real temporary SQLite and key files | Typed assertions and cross-module injection proof; final suite 12/12 |
| 11.2 | The same pre-existing integration suite rejected missing writes, overwritten checks and hidden persistence failures | Adapter read/create and module wiring passed 11/11 | Insert-only contract documented; independent connections and query failures covered in final 12/12 |

| Stage | Result |
|---|---|
| RED, missing adapter | Focused suite failed to import `prisma-key-check-store.js` |
| RED, wired no-op adapter | 10 failed, 1 passed: no row, no verification, lost/wrong key accepted, duplicate inserts accepted, persistence failure hidden |
| GREEN | 11/11 passed after implementing read and insert-only write |
| Final verification | 12/12 passed after adding a real query-failure scenario and strengthening cross-module injection assertions; typed assertions pass lint |

### Scenario evidence

| Scenario | Integration proof |
|---|---|
| Absent file, absent row | Generates k1; the only application row is an sb1 envelope decrypting to the public check, containing neither its plaintext nor base64 key material |
| Present file, absent row | Records the check; key file bytes unchanged |
| Present file, present row | Reopens the database, verifies the check; file, envelope and timestamp unchanged |
| Present file, wrong key | KEY_MISMATCH; replacement file and original row unchanged |
| Absent file, present row | KEY_FILE_REQUIRED; never regenerates; row unchanged |
| Malformed file | KEY_FILE_INVALID; both persisted artifacts unchanged |
| Multiple key ids and unrelated settings | Separate reads, absent id returns null, unrelated setting untouched |
| Duplicate and competing inserts | P2002, one winner across independent database connections, original check preserved |
| Persistence failure | Disconnected service and dropped table both propagate errors; no new key file |
| Nest module boundary | Importing consumer resolves both exported tokens; shared connection stays lazy and closes at shutdown |

Existing U7 limitations remain: bootstrap checks only the active key id (k1 when the file is absent); rotation tooling and reconciliation of historical key ids are deferred.

### Verification and rollback

Run with Node 24.21.0 and pnpm 12.11.2. All databases and key files used temporary directories and were removed by test/harness cleanup.

| Evidence | Value |
|---|---|
| Focused command | `pnpm --filter @importer/api exec vitest run src/persistence/prisma-key-check-store`: 1 file, 12 tests passed |
| Full gate | `pnpm check`: exit 0; API 733 passed, contracts 42 passed and 2 skipped; typecheck, lint and format pass. The first sandboxed attempt failed only because the existing ESM smoke could not listen on 127.0.0.1; rerun outside the sandbox passed. |
| Build | `pnpm build`: exit 0 |
| Built runtime harness | `node /private/tmp/u11-key-check-smoke.mjs`: exit 0, generated/recorded/verified/lost-key/wrong-key scenarios against the compiled adapters and a real migrated temporary SQLite database |
| Attempt recovery | The sandbox-only `EPERM` loopback-bind failure was settled as failed; the subsequent Node 24 retry is the correction candidate and reran all U11 evidence successfully. |
| Rollback boundary | Delete `persistence/prisma-key-check-store.ts` and its integration test; remove only the key-check import, token, factory and export from `persistence.module.ts`; revert the U11 task/checkpoint/progress hunks. U10 service, schema and migration remain independently usable. |
| Size | 296 authored code/test changed lines: adapter 25, integration test 260, module 10 additions and 1 deletion. No generated or dependency changes; SDD evidence is recorded alongside the unit. |

## Batch 12: U12 Local request guard

Branch `feat/foundation-u12-local-request-guard`. Tasks 12.1 to 12.3 complete (3/3 of Phase 12; 49 of 65 overall, counting as native SDD status does). Mode: Strict TDD.
Commits (separable, each green on its own): a578674 (pure allow-lists and decision rules), d9e69df (request facts, rejection type, tokens, Nest guard), 8822d85 (ApiError filter, module, HTTP and no-ship suites). The first commit is the contingency split named in tasks.md.

### Task 12.1: documentation check (design item 11, no browser)

Sources read, by fetching the published text (not from memory): the WHATWG Fetch Standard (living standard), the W3C Fetch Metadata Request Headers specification, and the MDN reference pages for the Origin and Sec-Fetch-Site headers.

Confirmed:

- Origin is added by the browser to cross-origin requests and to same-origin requests that are not GET or HEAD (MDN lists same-origin POST, OPTIONS, PUT, PATCH and DELETE). The documented exception is a cross-origin GET or HEAD in no-cors mode, which carries none; that is a safe method, which the guard does not restrict.
- Origin can be the string null (opaque origins: data and file documents, sandboxed documents, cross-origin redirects, privacy-blanked cases). The guard rejects it because it is on no allow-list.
- Sec-Fetch-Site values are same-origin, same-site, cross-site and none. The Fetch Metadata text says servers SHOULD ignore a value it does not define. D7 is stricter (a garbage value with no Origin is rejected); see decisions.
- Non-forgeability from page script: the Fetch Standard puts every header whose name starts with Sec- and the Origin and Host headers on the forbidden request-header list, so fetch and XMLHttpRequest cannot set or remove them from script. MDN marks Sec-Fetch-Site as a forbidden request header (Sec- prefix).

Not guaranteed, and so not relied upon: a non-browser client (curl, a script, a malicious local process) can send any value or none for any of these headers; a browser extension or a very old browser may omit Sec-Fetch-Site; Fetch Metadata shipped in browsers from about 2020 and later (Safari 16.4), so older browsers send nothing. The guard therefore never treats any of these headers as authentication: a bad Origin is rejected whatever Sec-Fetch-Site says (tested), and the rule only decides what to do for a request that has no Origin. The residual risk D7 accepts is unchanged: an old browser that sends neither header on a cross-site write. The loopback bind and the Host rule are the independent layers.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|---|---|---|---|---|---|---|---|
| 12.2/12.3 allow-lists | apps/api/src/local-security/allowed-origins.test.ts | Unit | N/A (new) | Failed: Cannot find module './allowed-origins.js' | 22/22, then 27/27 | default, custom port, IPv6, https, default port 80, non-loopback bind with and without a configured origin, 9 non-canonical origins, 5 bad ports, 6 bad hosts, error text fixed | Prettier; host test widened to six hosts after adding the path and userinfo cases |
| 12.2/12.3 decision | apps/api/src/local-security/request-policy.test.ts | Unit | N/A (new) | Failed: Cannot find module './request-policy.js' | 1,999/1,999 (1,972 in this file plus the 27 above) | 27 Host cases, 20 Origin cases, 11 Sec-Fetch-Site cases, 3 safe and 13 unusual methods, IPv6 host, and a 9 x 5 x 7 x 6 matrix (1,890 cells) | Removed one row that passed vacuously (an upper-cased digit string) |
| 12.2/12.3 facts | apps/api/src/local-security/request-facts.test.ts | Unit | N/A (new) | Failed: Cannot find module './request-facts.js' | 2,052 across the folder | single, absent, empty, case-insensitive names, repeated header, value not read as a name, 5 unreadable shapes | Dropped a needless cast reported by lint |
| 12.2/12.3 guard | apps/api/src/local-security/local-request.guard.test.ts | Unit (direct calls, fake execution context) | N/A (new) | Failed: Cannot find module './local-request.guard.js' | same run | 3 rejection kinds, no value in message, stack, JSON or property names for 3 headers, 4 fail-closed inputs, non-HTTP context, throwing context, logging once per rejection and nothing on allow, throwing logger | None needed |
| 12.3 filter | apps/api/src/local-security/local-request.filter.test.ts | Unit | N/A (new) | Failed: Cannot find module './local-request.filter.js' | same run | both codes validate against ApiError, no extra field copied, scoped to rejections only | None needed |
| 12.2/12.3 HTTP | apps/api/src/local-security/local-security.int.test.ts | Integration (real loopback socket, port 0) | N/A (new) | Failed: Cannot find module './local-security.module.js' | 21/21 (one test-side slip fixed first: a seed that was a valid hostname) | see list below | Prettier |
| 12.3 no-ship | apps/api/src/local-security/no-test-route-ships.test.ts | Unit (reads the source tree and build config) | N/A (new) | Failed: Cannot find module './local-security.module.js' | 5/5 | see proof below | None needed |

Matrix note: the decision file holds 1,890 generated cells plus the named tables (1,972 tests); with the allow-list file the two pure files hold 1,999.

### Mutation checks (each restored, folder re-run green; final 2,053/2,053)

| Mutation | Result |
|---|---|
| Host accepted when it only starts with an allowed value | 384 failed |
| Origin null accepted | 74 failed |
| No Origin with Sec-Fetch-Site cross-site accepted | 26 failed |
| Unknown or lower-case method treated as safe | 117 failed |
| Multi-valued Sec-Fetch-Site accepted | 1 failed |
| Non-canonical configured origin accepted | 5 failed |
| Guard allows on an internal error | 5 failed |
| Filter echoes the offending header value into the body | 6 failed |
| Repeated header collapsed to its first value | 3 failed |
| Guard not registered globally | 12 failed |
| Filter not registered | 10 failed |
| Non-HTTP context allowed | 1 failed |
| Rejection status 400 instead of 403 | 19 failed |
| Logging error escapes the guard | 1 failed |
| Log event carries an extra field | 2 failed |
| Policy ignores configuration | 10 failed |
| Policy build error swallowed into allow-everything | 1 failed |
| SURVIVED: remove the typeof check on Host | Equivalent mutant: a Set lookup of undefined or an array is false anyway; the check is a type narrowing |

### Guard decision table as implemented (default configuration)

Allowed Hosts: 127.0.0.1:3000, 127.0.0.1:5173, localhost:5173. Allowed Origins: http://127.0.0.1:3000, http://127.0.0.1:5173, http://localhost:5173. All rejections are 403.

| Method | Host | Origin | Sec-Fetch-Site | Result |
|---|---|---|---|---|
| any | missing, empty, repeated, or not on the list | any | any | 403 HOST_NOT_ALLOWED |
| GET, HEAD, OPTIONS | on the list | any (even foreign, null or repeated) | any | allow |
| any other method (POST, PUT, PATCH, DELETE, TRACE, CONNECT, lower-case or unknown) | on the list | on the list | any (including cross-site, garbage) | allow |
| non-safe | on the list | present and not on the list: foreign, null, empty, repeated, other scheme, port, case, slash, path | any (a forged same-origin does not help) | 403 ORIGIN_NOT_ALLOWED |
| non-safe | on the list | absent | absent, same-origin, none | allow |
| non-safe | on the list | absent | same-site, cross-site, any other value, empty, repeated, other case | 403 ORIGIN_NOT_ALLOWED |
| non-HTTP context, or any fault reading configuration or request | n/a | n/a | n/a | 403 HOST_NOT_ALLOWED |

### Evaluation order and the shape of a rejection

Host first, because it needs no other fact and applies to every method; then, for a non-safe method, Origin if present, else Sec-Fetch-Site. A request failing both reports only the Host check (tested). Status is 403 for every failure; the two checks differ only in the code (HOST_NOT_ALLOWED, ORIGIN_NOT_ALLOWED) and the fixed message (host not allowed, origin not allowed). The body is the ApiError shape from the contracts package, validated in the filter test and again over HTTP. No request value is echoed: tested on the error text, stack, JSON, property names, the HTTP body and the logged event, with a seeded odd value in Host, Origin and Sec-Fetch-Site. A fault inside the guard is reported as HOST_NOT_ALLOWED, because the first check could not be completed.

### Host normalisation (all strict: exact string match, nothing is normalised)

Missing or empty: rejected. Different letter case (LOCALHOST:5173): rejected, because the list holds the lower-case form browsers send. Trailing dot (localhost.:5173): rejected. Explicit default port (127.0.0.1:80), missing port, wrong port: rejected; when the API port is 80, the list holds the portless form, as a browser writes it. Userinfo, path, query, whitespace, tab: rejected. Several values (a repeated header, or one value with a comma): rejected; the guard reads the raw header list, so a repeat is seen even though Node would keep only the first Host. IPv6 literal in brackets: accepted only when the configured API host or an allowed origin is that address; the API host is bracketed when it contains a colon. IPv4-mapped forms (in dotted or hex form) and decimal IPv4 spellings: rejected unless configured verbatim (the origin list is canonical through the URL parser, so a hex mapped form is the form that would match). Prefix, suffix and embedded matches (127.0.0.1.evil.test, evil.test/127.0.0.1, localhost.attacker.example): rejected, there is no substring or pattern match anywhere.

### OPTIONS and preflight (what U13 can rely on)

The rules treat OPTIONS as a safe method: rule 1 applies, rules 2 and 3 do not, and the Access-Control-Request-Method header is never read, so a preflight and a plain OPTIONS are treated alike. In this application the guard is rarely even reached: Nest registers no OPTIONS handler, so an OPTIONS request to a write route is answered 404 by the router before any guard runs (tested for both forms, from a foreign origin, with no handler run and no allow-origin header). Consequences for U13: the CORS middleware must be registered so that it answers the preflight itself (the cors package ends the preflight with 204 before routing); an OPTIONS request that the middleware does not answer reaches nothing. Do not add an OPTIONS handler to any route, and never perform a state change on OPTIONS: it would be exempt from rules 2 and 3 by design. The guard only runs for requests that match a route, so an unrouted path (404) and the router's own OPTIONS answers do not get the Host check; they carry no data.

### Structure and the lint rules

The lint rules restrict NestJS imports only in the shared kernel and in port files, so a guard and a filter in the local-security folder are allowed by lint. The framework-free split was kept anyway, by choice: allowed-origins.ts, request-policy.ts and request-facts.ts are plain functions with no framework import and carry all the decisions (tested without Nest, 2,000 cases); local-request.guard.ts, local-request.filter.ts and local-security.module.ts are thin adapters with explicit tokens and explicit Inject, as earlier units did. The module is registered with forRoot(configModule, { logger }) like PersistenceModule, and installs the guard and filter through the global APP_GUARD and APP_FILTER providers. eslint.config.js was not touched.

### Proof that the test-only route does not ship

1. The controller exists only inside local-security.int.test.ts and is registered in a module that test builds.
2. no-test-route-ships.test.ts asserts: tsconfig.build.json excludes test files; no production source mentions the route prefix or the controller class; neither the security module (static or dynamic form) nor AppModule declares any controller; no file of the security folder reads process.env or import.meta.env, so no variable can enable it.
3. After pnpm build, a search of the dist folder for the route prefix and the controller name found nothing, and the folder holds no test file (command output in the report).

### Decisions where the design was silent or differed

- Unexpected exceptions: ApiError allows only HOST_NOT_ALLOWED and ORIGIN_NOT_ALLOWED, and this unit may not redefine it, so the filter handles guard rejections only. Any fault inside the guard is turned into a fail-closed 403 (HOST_NOT_ALLOWED, fixed text). An unexpected error thrown by a handler keeps the framework's generic 500, which exposes no message or stack (tested over HTTP). Brief item "the filter turns unexpected exceptions into a generic ApiError" is therefore met for the guard's own faults but not for handler errors. If a generic internal-error code is wanted, add it to the contracts enum in a later unit and widen the filter.
- Host allow-list: the API's own host and port plus the host of every allowed origin, exactly as D7 rule 1 says. The brief mentions loopback equivalents the design lists; D7 lists none, so none are added: with API_HOST 127.0.0.1 the Host localhost:3000 is rejected, and with API_HOST 0.0.0.0 the Host 127.0.0.1:3000 is rejected unless the operator adds an origin for it (the risk already noted under tasks.md Traceability).
- Own origin is built with the http scheme (the API serves plain HTTP).
- A configured origin that is not its own canonical http or https origin makes module construction throw with fixed text. The schema (U8) already guarantees this, so it is defence in depth; the application cannot start with a guard it cannot trust.
- Sec-Fetch-Site with an Origin present is ignored (D7 rule 2). It has to be: the web app at localhost:5173 calling 127.0.0.1:3000 is cross-site in a browser, with an allowed Origin. Tested in both directions.
- Garbage, empty, differently-cased and repeated Sec-Fetch-Site values with no Origin are rejected (D7 says allowed only when absent, same-origin or none). The Fetch Metadata text says servers SHOULD ignore unknown values; D7 is stricter and safer, and a future browser value would need a one-line change.
- Methods: exactly GET, HEAD, OPTIONS in upper case are safe; every other string, including lower-case spellings, TRACE and CONNECT, is state-changing; a non-string method is state-changing too.
- Logging: kept, since D7 and task 12.2 require a warn on rejection. The guard logs one event, local_request_rejected, with the check name only (host or origin), through an injected port limited to warn; it defaults to silent and U13 passes the RedactingLogger. A throwing logger never changes the outcome.
- Headers are read from the raw header list, not from the merged object: Node joins a repeated Origin with a comma and keeps only the first Host, which would hide a repeat. Verified over a raw socket: a repeated Origin (both copies allowed) gets 403 from the guard; a repeated Host also gets 403 from the guard (Node passes it on and keeps only the first copy in its merged object, so only the raw list shows the repeat); a missing Host gets 400 from Node's own parser before the guard.
- tasks.md names allowed-origins.ts, the guard, a filter and the module; three small support files were added (request-policy.ts for the pure rules, request-facts.ts for header reading, local-request-rejection.ts and local-security.tokens.ts) so the rules stay framework-free and the files stay under about 80 lines each.

### Carry-over for U13

- Import LocalSecurityModule.forRoot(configModule, { logger }) into AppModule with the same ConfigModule.forRoot(...) and the RedactingLogger.
- Register the CORS middleware for the D7 policy so that it answers preflights itself; the guard does not.
- The Host rule runs only for routed requests; a global prefix change does not affect it.
- With ALLOW_NON_LOOPBACK and API_HOST 0.0.0.0, set ALLOWED_ORIGINS to the externally used origin; the Host list is built from configuration only.
- Spec scenarios owned by U13: default bind, non-loopback refusal and opt-in, both CORS preflight scenarios, the key never in log output, startup abort. Owned by U14: foreign-origin GET /health. Owned by U17: README statement of the missing-Origin decision.

### Spec traceability (local-security-baseline)

| Scenario | Owner | Evidence |
|---|---|---|
| Origin guard: Foreign origin write (403, handler not run) | U12 | local-security.int.test.ts "rejects a foreign-origin write with 403 and never runs the handler" (POST, PUT, PATCH, DELETE); request-policy.test.ts matrix; guard and filter unit tests |
| Origin guard: Allowed origin write | U12 | local-security.int.test.ts "runs the handler for an allowed origin..."; matrix |
| Origin guard: Missing origin write (allow, unless cross-site or same-site) | U12 | local-security.int.test.ts Sec-Fetch-Site table (5 values); request-policy.test.ts 11 cases and matrix |
| Origin guard: safe methods unaffected | U12 | local-security.int.test.ts "never blocks a safe method"; matrix; U14 repeats it for the health route |
| Host rule (beyond the spec, D7 rule 1) | U12 | request-policy.test.ts 27 Host cases; HTTP Host tests; raw-socket repeat cases |
| Loopback-only binding (3 scenarios) | U8 (schema), U13 (bind) | U8 tests; the HTTP suite here only asserts its own test server bound to 127.0.0.1 |
| Restrictive CORS (2 preflight scenarios) | U13 | not in U12; U12 proves only that OPTIONS reaches no write handler and carries no allow header |
| Secret redaction (3 scenarios) | U4 and U5 (and U13 for the configured key) | not in U12 |

### Size

Hand-written added lines, 1,436 in total against a 400 budget and a ~350 forecast (4.1 times): source 341, tests 1,095. By commit: pure rules 497 (source 135, tests 362), guard 405 (source 135, tests 270), filter, module and HTTP 534 (source 71, tests 463). Not trimmed, nothing compressed. The cause is the exhaustive matrices and the HTTP suite the brief asked for; the three-commit split above is the smallest cohesive slicing (497, 405 and 534 lines, all over 400). A `size:exception` is recommended for the PR unless the orchestrator wants to slice the PR along these three commits.

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/api exec vitest run src/local-security`: 7 files, 2,053 tests passed |
| Runtime harness | Real HTTP round trips on an ephemeral 127.0.0.1 port (and a raw socket for repeated headers) inside local-security.int.test.ts, torn down in afterEach. Root `pnpm install --frozen-lockfile`, `pnpm check` (2,786 API and 42 contracts tests, 2 skipped) and `pnpm build` exit 0; no route in dist |
| Rollback boundary | apps/api/src/local-security/** only; the tasks.md checkbox hunk and this batch. No dependency, lockfile, config or earlier-unit file was changed |

## Batch 13: U13 Ordered boot, CORS, binding

Branch `feat/foundation-u13-boot`. Tasks 13.1 to 13.3 complete (3/3 of Phase 13; 52 of 65 overall, counting as native SDD status does). Mode: Strict TDD.
Commits (separable, each green on its own): 376ada3 (CORS policy middleware and tests), 9ecbe8e (key reconciliation, bind verification, exit mapping, with tests), 49245c4 (AppModule wiring, main.ts bootstrap, HTTP boot suite, task checkboxes), plus a docs commit for this file.

### Task 13.1 findings (design items 8 and 10)

Read from the installed packages, then exercised: Nest 12.1.3 `setGlobalPrefix(prefix, { exclude })`, `listen(port, hostname, callback?)` (from the installed interface declaration and `nest-application.js`), and the `cors` package 2.8.6 that Nest's `enableCors` wraps (read its source and drove it with fake request and response objects, no socket).

| Question | Result |
|---|---|
| Global prefix with the health route excluded | Works: `setGlobalPrefix('api', { exclude: ['health'] })`; a test-only health controller answers at the root and 404s under the prefix; a feature controller answers only under the prefix. |
| `listen` signature | `listen(port, hostname, callback?)` returns a promise; it rejects on an error event (for example EADDRINUSE), after logging the error text through the Nest logger. |
| Do Nest CORS options give exactly D7? | No. With an origin list, a foreign preflight still gets `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers` (204, no allow-origin). With an origin callback that returns false, the package skips itself entirely, so there is no `Vary: Origin` for foreign origins and the preflight falls through to the router (404). No option set gives both halves of D7. Fallback applied. |
| Abort on failure | `abortOnError: false` is passed to the only `NestFactory.create`; a provider that throws during creation surfaces as an ordinary rejection (tested). With the default, the test worker crashes (process abort), confirmed by mutation. |

### CORS policy as implemented (cors-middleware.ts, hand-written, framework-free)

Exact-match list from the validated configuration (canonical http or https origins only; the constructor throws for a wildcard or any non-canonical value, with fixed text). `Vary: Origin` on every response. Credentials never allowed. A preflight is an OPTIONS request with `Origin` and `Access-Control-Request-Method`; it is answered by the middleware itself with 204 and never reaches the router (no OPTIONS handler exists or is added, and nothing changes state on OPTIONS).

| Request | Status | CORS headers |
|---|---|---|
| Preflight, allow-listed origin | 204, empty body, content-length 0 | allow-origin (that origin), allow-methods (GET,POST,PUT,PATCH,DELETE), allow-headers (Content-Type), Vary: Origin |
| Preflight, any other origin (foreign, null, other port or scheme, other case, trailing slash, comma list, wildcard, empty) | 204, empty body | none at all; Vary: Origin only |
| OPTIONS that is not a preflight (no Origin, or no request-method header) | left to the router (404 on every route) | Vary: Origin; allow-origin only for an allow-listed origin |
| Actual request, allow-listed origin | handler runs (guard still applies) | allow-origin (that origin), Vary: Origin |
| Actual request, foreign origin (GET) | handler runs | no allow header, Vary: Origin; so the page cannot read it |
| Foreign-origin POST | 403 from the guard, handler not run | no allow header, Vary: Origin |
| No Origin header | passes through | Vary: Origin only |

### Boot order as implemented, and the difference from the design diagram

1. `loadConfig` (env file plus injected environment), before any Nest application. ConfigError, EnvFileError and PathError abort here.
2. `RedactingLogger` with the parsed `LOG_LEVEL`; near-miss env-file hints collected during the load are logged as warnings.
3. `FileKeyProvider.load()` through `loadKeyring` (diagram step "load key"): a malformed or too permissive file aborts before any app exists; a key that already exists is registered with the redactor now.
4. `NestFactory.create(AppModule.forRoot(...), { logger, abortOnError: false })`.
5. Connect `PrismaService` (typed MIGRATION_REQUIRED and DATA_DIR errors), then `reconcileKey` against the real `KeyCheckStore`, then register the (possibly just generated) key, then the one-time backup warning when the key was generated.
6. CORS middleware, global prefix with the health route excluded, the single `non_loopback_bind` warning when it applies, then `listen(port, host)`.
7. Bound address read back from the server; a non-loopback address without the opt-in closes the application and throws.
Any failure after step 4 closes the application (server and database connection) and rethrows.

Difference from the brief (the design wins): the brief put key and database before creating the application; the diagram creates it first and connects after, and that is what is implemented. Difference from the diagram: none other than the extra early key read (the diagram has it too). Consequence: the Nest startup lines are logged before the database is connected; a key that does not exist yet cannot be in any log line by then, and an existing one is registered before step 4 (proved by a test that logs the key from a provider factory during creation).

### Key forms registered as secrets

For every key in the ring (not only the active one): base64 as written in the key file (padded), base64 without padding, base64url (padded and without padding), hex lower case and hex upper case, de-duplicated. Reason: these are the encodings an operator or a library would print (the file line, a URL-safe token, a hex dump). Not covered, by design of exact-match redaction: pieces of the key, other encodings (for example decimal byte lists), and a key inside an object key name. Buffers and typed arrays are already reduced to a byte count by `redact()`.

### Duplicate-key decision

On Prisma P2002 from the insert-only key-check store, `reconcileKey` re-runs the bootstrap exactly once. That run reads the winner's row and verifies against it (verified when the keys agree, KEY_MISMATCH when they do not). A second P2002 aborts with the new typed `BootError` code KEY_CHECK_CONFLICT. Other failures are never retried. Known remaining race, not changed: two first starts that both find no key file; the loser's exclusive create fails and it aborts with KEY_FILE_INVALID (the file is never overwritten); a restart succeeds.

### Other decisions where the design or the brief was silent

- `bootstrap(options)` returns `{ address, droppedEvents(), close() }` and never calls `process.exit`. Inputs: environment, workspace root, env file, home, log sink, port override, plus two test seams, `extraModules` and `listen`. `main.ts` passes neither seam (asserted in the no-ship test) and no environment variable reads them.
- `droppedEvents` is exposed on the handle (a getter function), tested by breaking the sink after boot.
- LoggerService assertion: `main.ts` declares a type alias constrained to Nest's `LoggerService` for `RedactingLogger`; `tsc` evaluates it. Negative control: removing the `error` method made `tsc` fail at that line.
- `AppModule.forRoot({ config, logger, extraModules? })` gives `ConfigModule` the configuration already loaded in step 1 (a value provider under `APP_CONFIG`), so the env file is read once and every module sees one object. `ConfigModule.forRoot` was not changed.
- The loopback rule exists twice (the schema's private helper and `local-security/bind-policy.ts`); a test compares them over 16 hosts so they cannot drift. Exporting the schema's helper later would remove the copy.
- The bound-address rule: a loopback address is always accepted; anything else needs the opt-in; a pipe or a missing address is always refused. IPv4-mapped IPv6 loopback is refused, as in the schema.
- Exit mapping (pure, tested per class): BootError, ConfigError, EnvFileError, PathError, PersistenceError, SecretBoxError exit 1 with one redacted line (class, code, reason); everything else exits 70 and prints only the class name, because unknown messages were never audited. SIGINT and SIGTERM in the entry block close the application and exit 0.
- Entry block: `isMainModule(import.meta.url, argv[1])` tolerates the Nest CLI starting the build output without the file extension.
- With 0.0.0.0 and the opt-in the guard's Host list comes from configuration only. Tested: a Host with the machine's address and also 127.0.0.1 on the API port get 403 HOST_NOT_ALLOWED until ALLOWED_ORIGINS names the externally used origin. The single `non_loopback_bind` event now lists the accepted Host values and says to add the origin, so the lock-out is visible at start-up; no second event was added and boot does not refuse.
- Routed requests only: the Host check and the guard run for routes that exist. The built program answered an unrouted foreign POST with 404 (no route in S0); the HTTP suite proves 403 on real routes.

### TDD Cycle Evidence

| Task | Test file | Layer | Safety net | RED | GREEN | Triangulate | Refactor |
|---|---|---|---|---|---|---|---|
| 13.1/13.3 CORS | apps/api/src/local-security/cors-middleware.test.ts | Integration (loopback port 0, real http server) | 293 existing config and no-ship tests green | Failed: Cannot find module './cors-middleware.js' | 33/33 | 2 allowed preflights, 10 foreign preflights, 2 non-preflight OPTIONS, 5 allowed and 3 foreign methods, no origin, credentials, custom and empty lists, 6 bad constructor values, error hygiene | Lint fix (useless assignment) |
| 13.3 bind policy | apps/api/src/local-security/bind-policy.test.ts | Unit | N/A (new) | Failed: Cannot find module './bind-policy.js' | 103/103 with the two files below | 5 and 10 address cases, 4 and 6 host cases, 16 schema-agreement hosts, 4 refused, 3 accepted with opt-in, 2 non-network values, event cases | None needed |
| 13.3 exit mapping | apps/api/src/process-exit.test.ts | Unit | N/A (new) | Failed: Cannot find module './process-exit.js' | 24/24 | one case per class (6), multi-issue line, redaction, 7 unexpected values, 4 entry-path cases plus 5 negatives | Joined ConfigError lines more readably after a failing exact-line assertion |
| 13.3 key helpers | apps/api/src/key-boot.int.test.ts | Integration (temp databases, two connections) | N/A (new) | Failed: Cannot find module './key-boot.js'; later loadKeyring is not a function | 24/24 | key forms, ring registration, real P2002, 7 error shapes, 6 reconcile scenarios, 4 loadKeyring cases | None needed |
| 13.2/13.3 boot and HTTP | apps/api/src/main.int.test.ts | Integration (real servers on loopback port 0, temp dirs) | N/A (new) | Failed: Cannot find module './main.js' | 41/41 (first run green) | see list below | Prettier; spy typed for lint |
| 13.3 no-ship | apps/api/src/local-security/no-test-route-ships.test.ts | Unit | 5/5 existing | n/a (the behaviour already held; proven by mutation instead) | 7/7 | AppModule dynamic graph has no controller; main.ts starts with no options and reads no environment | None needed |

The boot suite covers: default bind and the really bound address; IPv6 loopback; the name localhost; a stubbed non-loopback bound address closing the server (with and without the opt-in); port already taken; close(); the opt-in event (exactly one, before the socket call, with host and port); no event for loopback or without the opt-in; refusal without the opt-in before any app, key or listen; the lock-out and its fix; six configuration failure shapes before any app exists; the env file read from the injected root; LOG_LEVEL honoured; key generation with the backup warning once; the default key path under the injected home; loose key file; key mismatch never reaching listen; absent key with a stored check never regenerating; unmigrated database with no key generated; unusable DATA_DIR; two simultaneous starts; the key in six forms absent from output (seeded, generated, and logged during creation); Nest lines through the redacting logger; droppedEvents; prefix and health exclusion; allowed and foreign preflights; foreign GET without an allow header; foreign, allowed and no-origin POST; plain OPTIONS answered 404; Host rejection; process.exit never called.

### Mutation checks (each restored, suite re-run green)

| Mutation | Result |
|---|---|
| CORS: drop Vary | 22 failed |
| CORS: wildcard allow-origin | 10 failed |
| CORS: reflect any origin | 16 failed |
| CORS: allow-methods for foreign origins | 11 failed |
| CORS: add allow-credentials | 3 failed |
| CORS: preflight passed to the router | 13 failed |
| Key helpers: remove the duplicate-key retry | 3 failed |
| Key helpers: second duplicate not typed / registerKeyring registers nothing / drop upper-case hex, unpadded base64 or padded base64url (one each) / isDuplicate never true | 1, 2, 1 each, 6 failed |
| Exit mapping: known error exits 0 / unexpected exits 0 / BootError or PathError not recognised | 7, 7, 2, 1 failed |
| Bind policy: verification skipped / opt-in ignored / event without opt-in / any IPv6 is loopback | 4, 3, 1, 7 failed |
| main.ts: Nest application created before the configuration is loaded | 6 failed |
| main.ts: skip registerSecret after reconcile | 1 failed (generated key) |
| main.ts: skip registerSecret everywhere | 1 failed; skipping only the early registration first SURVIVED, then a test logging the key during creation was added and it fails 1 |
| main.ts: skip CORS middleware | 4 failed |
| main.ts: skip bound-address verification / treat opt-in as always on | 1 failed each |
| main.ts: continue after a key mismatch | 1 failed |
| main.ts: no health exclusion | 1 failed |
| main.ts: event emitted twice / after listen | 1 and 2 failed |
| main.ts: application not closed on failure | 3 failed |
| main.ts: droppedEvents fixed at 0 / no backup warning / port override ignored | 1, 1, 3 failed |
| main.ts: abortOnError left at default | the test worker crashes (process abort), no pass line; it left one temp folder, removed by hand |
| AppModule gets a controller / main.ts passes options | 1 failed each (no-ship test) |
| redacting-logger.ts loses its error method | tsc fails at the main.ts assertion |

### Runtime harness

Built program: `pnpm build`, then the built entry file run with an explicit minimal environment (empty inherited environment, home, data folder, key file and an ephemeral loopback port all inside a scratch folder), after applying the committed baseline SQL with the driver. Results: HTTP answered on loopback; allowed preflight 204 with the allow headers; foreign preflight 204 with Vary only; key file mode 600 in a 700 folder; the key text absent from stdout and stderr; seven JSON log lines; SIGTERM exit 0 and no listener left. Three failing starts printed one line each and exited 1 (bad port, non-loopback host without opt-in, unmigrated database); the unmigrated start created no key folder. The scratch folders were removed.

### Spec traceability (scenarios assigned to U13)

| Scenario | Test |
|---|---|
| Loopback binding: default bind | main.int.test.ts "listens on the configured loopback address and reports what is really bound" (default host) |
| Non-loopback without opt-in (aborts naming the host setting) | main.int.test.ts "refuses a non-loopback host without the opt-in before anything is created or listened on" |
| Non-loopback with opt-in (listens on that host, warns once) | main.int.test.ts "logs exactly one non_loopback_bind warning, before the socket call" (stubbed listen, nothing bound on the network); the really bound address check with a stubbed address |
| Restrictive CORS: allowed and disallowed preflight | main.int.test.ts HTTP block (two tests) and cors-middleware.test.ts matrix |
| Origin guard over HTTP: foreign, allowed, missing origin | main.int.test.ts HTTP block (foreign POST 403 with handler not run, allowed POST, no-origin POST); foreign GET without an allow header |
| Log redaction: configured key value never in output | main.int.test.ts "the key never appears in log output" (three tests) |
| runtime-configuration: abort before listening, exit path | main.int.test.ts configuration block; process-exit.test.ts; built-program exit codes |
| persistence-baseline: unwritable path, migration required at boot | main.int.test.ts "the data directory" and the unmigrated test; process-exit.test.ts |
| secret-protection: key mismatch, absent key with stored check, loose key at boot | main.int.test.ts key handling block |
| Open for U14: foreign-origin GET on the health route; readiness; U17: README statement of the missing-Origin decision | not in U13 |

### Size

Hand-written lines on the branch, excluding openspec: 2,138 added and 3 removed (about 575 source, 1,560 tests) against a 400 budget and a ~295 forecast (7.3 times). By commit: CORS 272 (source 62, tests 210), boot helpers 777 (source 244, tests 533), AppModule, main.ts and the HTTP suite 1,102 (source about 271 with main.ts 207, tests about 831 with the boot suite 764). Not trimmed. A `size:exception` is recommended, or the PR can be sliced along the three commits (272, 777 and 1,102), of which only the first fits the budget.

| Evidence | Value |
|---|---|
| Focused test | `pnpm --filter @importer/api exec vitest run src/main src/local-security`: all green; `main.int.test.ts` 41 tests |
| Full gate | `pnpm check` exit 0 (2,969 API tests, 42 contracts, 2 skipped); `pnpm build` exit 0 |
| Runtime harness | built program run described above |
| Rollback boundary | apps/api/src/main.ts, app.module.ts (back to the empty module), key-boot.ts, process-exit.ts, local-security/cors-middleware.ts and bind-policy.ts with their tests, the three added BootError codes, the no-ship test additions; the tasks.md checkboxes and this batch |
