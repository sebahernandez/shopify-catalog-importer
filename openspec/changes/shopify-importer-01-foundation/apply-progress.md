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
