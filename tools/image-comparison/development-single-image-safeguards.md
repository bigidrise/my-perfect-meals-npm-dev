# Controlled Development image-test safeguards — prepared, not activated

## Status

Source preparation and mocked verification only. No live requests, test identities,
real database records, image objects, recovery, environment changes, restart,
native build, publishing or deployment were performed.

The existing backend remains PID 5727, started 2026-10-23 23:55:06 UTC.
Its three new diagnostic settings are absent. The diagnostic receipt directory
was not created. This preparation is not loaded into that already-running backend.

## Authority and isolation

- Scope is established only after successful normal browser-session or bearer
  authentication, from the database-derived account, before downstream work.
  Inline generation and asynchronous prewarm inherit the same scope.
- The exact operator-configured UUID account must have `isSandbox=true` and the
  reserved synthetic email `image-test+<run UUID>@example.invalid`.
- Only Berry Coconut Chia Parfait with the `snack` image source is authorized.
  Request bodies, query parameters and headers cannot select an identity or scope.
- The normal recipe cache hash includes the run and synthetic identity only
  inside this scope. Normal cache identities remain byte-compatible.
- All canonical image variants go under
  `development-image-tests/<run UUID>/<subject digest>/`, not `meal-images/`.
  New media rows are marked `development-image-test`; failed test assets have
  no automatic retry schedule.
- Scoped cache/storage references to historical or unrelated image locations
  are rejected. Upload sources must be the actual generated image or an already
  isolated permanent reference. No-source and arbitrary legacy wrapping are blocked.
- A failed isolated persistence step returns a truthful placeholder, never an
  apparently durable photograph or an ephemeral base64 substitute.

## One initial generation, one associated verification

Before SDK dispatch, exclusive-create, fsynced receipts reserve generation and
verification separately under the ignored local diagnostic directory. They
survive a backend process restart and are never automatically refunded, removed
or reused. A failed claim stops dispatch.

Verification must reference the exact generated image. Fidelity failure does
not enter regeneration. The operation also independently caps generation at one,
and the run receipt blocks a second operation or changed recipe-key request.
Existing SDK retries remain disabled.

Receipts are Development workspace files, not a distributed billing quota.
Keep them intact; filesystem loss/reset must stop the test and require a new
review, not authorize a replay. A receipt is a dispatch reservation, not proof
of billing or confirmed provider cancellation.

## Future activation requires separate approval

No values were set for:

- `DEVELOPMENT_IMAGE_TEST_ENABLED` (must equal `approved-single-image`)
- `DEVELOPMENT_IMAGE_TEST_RUN_ID` (operator-chosen UUID v4)
- `DEVELOPMENT_IMAGE_TEST_USER_ID` (exact authenticated synthetic UUID v4)

The Development bootstrap and existing Flare activation gate are also required.
Production, any deployment marker, partial settings and invalid IDs are rejected.
There is no new HTTP diagnostic endpoint and no automatic scheduler or failover.

Before activation, separately approve a coordinated restart, synthetic-account
creation and any live test. Recheck all normal Snack Creator writes, subject
ownership, queue state, receipts and object namespace before spending. These
mocked results do not certify a live end-to-end snack, byte digest or delivery.
Do not use ordinary cache invalidation or historical recovery as test setup.

## Verification

- 267 mocked tests passed across 13 suites.
- Root TypeScript reports 120 diagnostics; none are in changed files.
- Browser-session and bearer paths, revoked sessions, synthetic-identity checks,
  asynchronous scope propagation, receipt replay, one vision request, disabled
  fidelity regeneration, cache separation, isolated variants, failure truthfulness,
  legacy clients, saved-photo immutability and recovery boundaries are covered.
- Database, provider, image-processing and object-storage operations in the
  new tests are mocked; the default receipt filesystem is mocked in its test.
- Git whitespace/status auditing was blocked by the workspace index-lock guard;
  no unsafe override or Git mutation was attempted.

Runtime source changes are confined to authentication scope propagation,
the shared image generator/reliability/verifier, canonical media persistence,
and the new server-only scope helper. The three image endpoint implementations
retain their existing API contracts and inherit the authenticated scope.
