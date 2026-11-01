# Final release readiness review

**Follow-up:** the inherited native-origin mismatch documented below was subsequently verified as a test-only defect and corrected. See [Native API origin verification](native-api-origin-verification.md) for independent Production evidence and current results. Original run results below are retained for audit history.

## Scope

- Branch: `integration/all-approved-development-20261031`.
- Starting source: `912467d35`.
- Review the two catalog Add/Save failures and the storage-health warning. Preserve Product Scan, Saved Groceries ownership, clinical and subscription policies.
- No merge, push, activation, deployment, publication, paid generation, native build, or shared-account fixture writes.

## Grocery Coach Add/Save failures

The unchanged original suite reproduced **2 failed / 1 passed**.

Both failures happened at `findByTestId("catalog-product-match")`, before either action was clicked. The fixture returned `{ catalogMatches, advice, catalogSearchAvailable }` to Find a Product, but its current request is `/api/biometrics/ingredient-scan-by-name` and its acceptance contract is `{ ok: true, result: { analysisMethod: "by_name", fallbackUsed: false, ... } }`. The old fixture correctly falls into “no results”; it cannot establish a member-facing Add or Save failure.

### Disposition

- Updated both tests to the real by-name response and actual shared Product Scan UI, without restoring an obsolete production code path.
- Add now checks the real `addItems` handoff, exact brand/variant/UPC label, quantity, source, and duplicate prevention.
- Save now uses the real shared `apiRequest` path and React Query provider. It asserts exact identity, original analysis snapshot, unverified evidence, absence of fabricated ingredients, no shopping-list insertion, and a fresh retrieval after unmount/cache clear/reopen.
- Kept the distinct-UPC normalization test.
- Added a real Saved Groceries HTTP-router save/list/reopen roundtrip using an isolated SQL-aware database fixture. Caller-supplied ownership is ignored; another account sees no saved rows and its idempotent delete does not remove the owner's row.
- The delete fixture requires both bound row and owner predicates. Production deletion semantics remain unchanged.
- Ran the existing **43-test individual recommendation suite**, covering saving the selected branded recommendation, permanent retrieval, account switches, late responses, failed saves, duplicate prevention, Product Scan snapshots, and shared card restoration.

**Result:** original catalog suite **3/3 passed**; Saved Groceries route suite **18/18 passed**; recommendation suite **43/43 passed**. No verified member-facing grocery implementation defect was found; no Grocery Coach/Product Scan/Saved Groceries runtime implementation was changed.

These are component and actual Express-route tests with isolated persistence fixtures, not live subscriber sessions or writes into shared Neon. No claim of a live-account save was made.

## Storage-health warning

The previous script looked for `hasS3: true` in `/api/health`. That response does not define `hasS3`; a bucket configuration field alone also cannot prove operational access.

The existing `/api/health/full` endpoint uses a write/read canary. It was deliberately **not called** to avoid an unnecessary storage write.

### Correction

- Added `/api/health/storage` to both the early Production entrypoint and shared route registration.
- The endpoint resolves the authoritative meal-image environment/bucket, then makes one SDK `list` request limited to one result under the health-probe prefix. Empty results are valid.
- Invalid configuration, credential/permission/service failures, or exceptions return **503**, without exposing SDK details or bucket contents.
- Responses are non-cacheable and explicitly state `probe: "read-only"` and `writeVerified: false`.
- Replaced the obsolete `hasS3` inference with a bounded, non-redirecting JSON health client. Failed HTTP status, malformed/old contracts, transport errors and invalid JSON fail release validation rather than becoming a warning or silent pass.
- Existing upload, download, public-image delivery, write/read canary, bucket policy and credentials are unchanged.

### Live findings

The new endpoint returned **HTTP 200** with:

```json
{"objectStorage":"readable","probe":"read-only","writeVerified":false}
```

This establishes current authoritative configuration and SDK **metadata/list read access**, not upload durability or a full object-content download. No object was created, overwritten or deleted. The original warning was a validation-contract mismatch, not evidence of an observed storage-configuration outage.

**Storage probe tests: 17/17 passed**, including empty buckets, invalid configuration, permission/credential/service failures, exceptions, no-write assertions, and rejection of non-authoritative health responses.

## Final verification

- Main regression selection: **22 suites passed / 1 suite failed; 299 tests passed / 1 failed**.
- Additional existing recommendation suite: **1 suite / 43 tests passed**.
- Combined: **23 suites passed / 1 failed; 342 tests passed / 1 failed**.
- Grocery Coach Add/Save, Saved Groceries retrieval/ownership, Product Scan by-name reuse, authentication/session/CSRF, subscription/Stripe entitlement, current GLP-1/clinical authority, and pregnancy access regressions passed.
- Ask Chef remains Pro-or-above and My Perfect Menu Essential-or-above. Their access-matrix suites pass. Activation gates, shared tier policy and authorized family/provider access rules are unchanged.
- Strict safety types and both Production builds passed.
- Strict TypeScript release gate passed against the **unchanged 118-diagnostic fingerprint**. No baseline refresh or suppression; root compilation still has the reviewed legacy debt.
- Full `NODE_OPTIONS=--max-old-space-size=4096 npm run release-check`: **exit 0; 13 passed, 0 warnings, 0 failed**.
- The main preview was restarted once with unchanged safe-start settings; captured startup logs confirm migrations, seeding, schedules and workers were suppressed and full initialization completed.

### Additional unresolved native test

The broader storage/routing suite revealed one inherited assertion:

`server/tests/apiRoutingStorageRepair.test.ts` expects the native API origin to be `https://app.myperfectmeals.com`, while `client/src/lib/resolveApiBase.ts` returns `https://app.myperfectmeals.ai`.

Both the test and resolver are byte-for-byte unchanged from the starting integration source. The resolver's `.ai` value also matches the preserved Production source. This failure is independent of the new storage endpoint and grocery test repairs.

No native origin or assertion was changed to make it pass. Owner disposition is required: confirm the intended native origin and authorize the appropriate test/configuration correction. This review does not establish that a mobile app is broken, nor does a passing web release script resolve that native contract.

## Readiness

The two requested catalog-test failures and obsolete storage warning are resolved. Supported web release checks pass without warnings. **Unconditional release approval remains withheld because the expanded regression selection still contains the native-origin test/source mismatch above.**

Signed-in grocery screens were not visually verified. Verification uses component/HTTP tests and read-only live storage evidence. The public landing page rendered normally in the screenshot browser; the running preview reports `ok: true`, `initialized: true`, no initialization error, and billing enforcement enabled.

Evidence is retained under `final-readiness-2026-10-31/`.
