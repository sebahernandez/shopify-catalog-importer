# Delta for Shop Domain Guard

New capability. The guard turns operator input into a canonical shop domain, or rejects it, before any outbound call. It is the only way a host reaches `fetch`. A rejection carries a reason code from a closed set (`EMPTY`, `WHITESPACE`, `BACKSLASH`, `PERCENT_ENCODING`, `USERINFO`, `PORT`, `PATH`, `TRAILING_DOT`, `IP_LITERAL`, `NON_ASCII`, `EXTRA_LABELS`, `ADMIN_STORE_URL`, `WRONG_SUFFIX`, `INVALID_HANDLE`) and never the input. ASSUMPTION: the handle grammar is unverified against real stores (research item Q-R2 is deferred to the live smoke test).

## ADDED Requirements

### Requirement: Accepted input forms and canonical result

The guard MUST accept exactly three input forms: a bare handle (`mystore`), a full domain (`mystore.myshopify.com`), and a pasted URL with the scheme `http` or `https` whose host is `<handle>.myshopify.com`, from which only the host is used (query and fragment are ignored). The result MUST be the canonical domain `<handle>.myshopify.com` in lower case. Upper case input MUST be lowered. The outbound scheme is always `https`, whatever the pasted scheme was.

#### Scenario: Bare handle

- GIVEN the input `MyStore`
- WHEN it is canonicalized
- THEN the result is `mystore.myshopify.com`

#### Scenario: Full domain

- GIVEN the input `mystore.myshopify.com`
- WHEN it is canonicalized
- THEN the result is `mystore.myshopify.com`

#### Scenario: Pasted admin URL

- GIVEN the input `https://mystore.myshopify.com/admin/products?limit=5#top`
- WHEN it is canonicalized
- THEN the result is `mystore.myshopify.com`

#### Scenario: Pasted http URL

- GIVEN the input `http://mystore.myshopify.com`
- WHEN it is canonicalized
- THEN the result is `mystore.myshopify.com` and any later request uses `https`

### Requirement: Handle grammar

ASSUMPTION: a handle MUST match `^[a-z0-9][a-z0-9-]{0,58}[a-z0-9]$` (2 to 60 characters, letters, digits and hyphens, not starting or ending with a hyphen) after lowering, and MUST NOT start with `xn--`. Anything else MUST be rejected with `INVALID_HANDLE`. An all-digit handle is valid because the suffix is fixed.

#### Scenario: Length bounds

- GIVEN handles of 2 and 60 valid characters, and of 1 and 61 characters
- WHEN each is validated
- THEN the first two are accepted and the last two are rejected with `INVALID_HANDLE`

#### Scenario: Forbidden characters

- GIVEN `my_store`, `-store`, `store-` and `my store`
- WHEN each is validated
- THEN each is rejected

#### Scenario: Punycode label

- GIVEN `xn--mystore-abc`
- WHEN it is validated
- THEN it is rejected with `INVALID_HANDLE`

#### Scenario: Digits only

- GIVEN the input `2130706433`
- WHEN it is canonicalized
- THEN the result is `2130706433.myshopify.com`

### Requirement: Syntax rejections

The guard MUST reject, before parsing a host: empty input (`EMPTY`); any whitespace anywhere, including leading, trailing and newlines (`WHITESPACE`); any backslash (`BACKSLASH`); any percent sign (`PERCENT_ENCODING`); userinfo in a URL, including `mystore.myshopify.com@evil.example` (`USERINFO`); any explicit port, including `:443` (`PORT`); a path other than empty, a single slash, or `admin` optionally followed by a slash and further segments (`PATH`); a trailing dot on the host (`TRAILING_DOT`); IPv4 and IPv6 literals such as `127.0.0.1`, `[::1]` and `169.254.169.254` (`IP_LITERAL`); and any non-ASCII character, including Unicode confusables and internationalized names (`NON_ASCII`).

#### Scenario: Credentials in URL

- GIVEN `https://user:pw@mystore.myshopify.com`
- WHEN it is validated
- THEN it is rejected with `USERINFO`

#### Scenario: Port

- GIVEN `https://mystore.myshopify.com:8443/admin`
- WHEN it is validated
- THEN it is rejected with `PORT`

#### Scenario: Foreign path

- GIVEN `https://mystore.myshopify.com/other/path`
- WHEN it is validated
- THEN it is rejected with `PATH`

#### Scenario: IP literals

- GIVEN `127.0.0.1`, `http://[::1]/` and `http://169.254.169.254/`
- WHEN each is validated
- THEN each is rejected with `IP_LITERAL`

#### Scenario: Encoding and separators

- GIVEN `mystore%2emyshopify.com`, `mystore.myshopify.com\evil`, `mystore.myshopify.com.` and ` mystore`
- WHEN each is validated
- THEN they are rejected with `PERCENT_ENCODING`, `BACKSLASH`, `TRAILING_DOT` and `WHITESPACE`

#### Scenario: Unicode

- GIVEN `mystоre.myshopify.com` with a Cyrillic letter, and `mystore.myshopify.com` followed by a zero-width space
- WHEN each is validated
- THEN each is rejected with `NON_ASCII`

### Requirement: Host rejections and fixed suffix

A host that is not exactly `<one handle label>.myshopify.com` MUST be rejected. This covers extra labels (`a.b.myshopify.com`, `EXTRA_LABELS`), lookalike suffixes (`myshopify.com.evil.example`, `evilmyshopify.com`, `mystore.myshopify.com.evil.example`, `WRONG_SUFFIX`), the apex `myshopify.com` itself, store URLs on `admin.shopify.com` (`ADMIN_STORE_URL`), and custom domains (`shop.example.com`, `WRONG_SUFFIX`). The suffix `.myshopify.com` MUST be a constant in code and MUST NOT come from configuration or the environment.

#### Scenario: Lookalikes

- GIVEN `myshopify.com.evil.example`, `evilmyshopify.com` and `https://evil.example/mystore.myshopify.com`
- WHEN each is validated
- THEN each is rejected with `WRONG_SUFFIX`

#### Scenario: Extra label

- GIVEN `a.b.myshopify.com`
- WHEN it is validated
- THEN it is rejected with `EXTRA_LABELS`

#### Scenario: Admin store URL

- GIVEN `https://admin.shopify.com/store/mystore`
- WHEN it is validated
- THEN it is rejected with `ADMIN_STORE_URL`

#### Scenario: Custom domain

- GIVEN `https://shop.example.com`
- WHEN it is validated
- THEN it is rejected with `WRONG_SUFFIX`

#### Scenario: Suffix not configurable

- GIVEN any environment variable or configuration value
- WHEN the guard is built
- THEN no variable changes the accepted suffix

### Requirement: URLs are built only from the validated domain

Every outbound URL MUST be built from a validated canonical domain value, never from raw input: fixed scheme `https`, the host, no port, no userinfo, no query for the GraphQL URL, and a fixed path (`admin/api/<version>/graphql.json` or `admin/oauth/access_token`). The HTTP adapter and the token exchange MUST accept only the validated domain value, not a string, and MUST refuse any request they did not construct themselves.

#### Scenario: GraphQL URL

- GIVEN the domain `mystore.myshopify.com` and version `2026-10`
- WHEN the URL is built
- THEN it equals `https://mystore.myshopify.com/admin/api/2026-10/graphql.json`

#### Scenario: Token URL

- GIVEN the domain `mystore.myshopify.com`
- WHEN the token URL is built
- THEN it equals `https://mystore.myshopify.com/admin/oauth/access_token`

#### Scenario: Raw strings refused

- GIVEN a caller passing a raw string instead of a validated domain value
- WHEN the adapter is invoked
- THEN it fails at compile time or refuses at run time and `fetch` is not called

### Requirement: Redirects are refused and rejected hosts never reach fetch

Every outbound request MUST set `redirect: 'error'`, so a redirect response (any 3xx with a location, for example a renamed store) fails the call with `NETWORK` and the target is never contacted. Input rejected by the guard MUST NOT result in any `fetch` call.

#### Scenario: Redirect to another host

- GIVEN a scripted `fetch` that signals a redirect to `https://evil.example`
- WHEN a read runs
- THEN the result is `NETWORK` and no second request is made

#### Scenario: Request option

- GIVEN a recorded `fetch` call
- WHEN its options are inspected
- THEN `redirect` is `error`

#### Scenario: Rejected input

- GIVEN a create or verify flow started with any rejected input from the scenarios above
- WHEN it runs
- THEN the `fetch` spy has zero calls
