# Stage 3C.1 — one controlled Development image test

## Outcome

**Passed.** One authenticated normal application image request produced a verified,
durable Berry Coconut Chia Parfait photograph. No second image generation,
verification or fidelity-regeneration request was made. No direct provider test,
saved-meal repair, existing Favorites change, Production publish, native build,
automatic failover or retirement scheduler activation occurred.

The test ran against Development backend PID **8028**, started October 24, 2026
at 00:52:11 UTC, using reviewed source version
`57ca578e00f8b42fe676ed4a02781b11579abf3e` with safe startup maintenance
suppression and approved Flare activation. The backend's diagnostic settings
targeted only the synthetic sandbox actor for this run.

## Paid requests and accounting

| Stage | Confirmed requests | Model | Provider request ID | Estimated usage cost |
| --- | ---: | --- | --- | ---: |
| Image generation | 1 | `gpt-image-2.5-flare-2026-09-08` | `req_9cf0e535bf5245009e0310472baa051b` | $0.008055 |
| Recipe verification | 1 | `gpt-4o` | `req_8436ad4617744467afee87388e28df89` | $0.0012925 |
| **Total** | **2** | | | **$0.0093475** |

These are the application's validated token-usage **estimates**, not a provider
invoice. Its $0.25 spending reservation is a planning guard, not the actual
charge. Typed result: generation `succeeded`, verification `passed`,
persistence `durable`, display `photograph`, attempts `1`, no cancellation or
accounting uncertainty. The HTTP image request returned 200.

The first credential preflight used the wrong HTTP header and returned 401,
with **zero** image requests or dispatch receipts. It was corrected to the
application's normal `x-auth-token` header before any generation; the same
authorized run and synthetic account were retained. No alternate meal, model,
run or image-generation retry was used.

Before dispatch, the recovery-job table contained 14 completed jobs and
**zero pending/processing jobs**. There were also 53 historical failed media
rows with retry timestamps, but the audited Development source has no automatic
worker consuming those timestamps in safe-restart mode. Those historical rows
were not changed or processed by the test.

## Isolation and reload evidence

- The synthetic account was created with its reserved address and `is_sandbox`
  flag. Its bearer credential was revoked after the test. No email was sent.
- The exclusive, persistent `generation.json` and `verification.json`
  reservations are still present for the run. They were never refunded or
  removed. The source reserves each receipt before dispatch.
- The verified cache row uses the run-specific key
  `3bb079bd272fb5d480a9433cbb28c19f`. Its URL points into the isolated
  Development Object Storage bucket at
  `development-image-tests/bd0ecc12-86de-4de4-9eae-cd0a5facf62d/35278e84be143074/`.
  The canonical media row is `ready`, marked `development-image-test`, and
  has no recovery retry timestamp. Original, display and thumbnail objects
  all use that prefix, not `meal-images/`.
- Two independent HTTP reloads of the saved thumbnail returned 200 and
  **26,958 bytes** each. Both SHA-256 digests exactly matched the bytes read
  back from Object Storage:
  `d54c0c57d85dd4bf6c082b9a644e2b3041bf55545b3b67ab43276bf82a226caa`.
  The stored original PNG has SHA-256
  `5e308cac88373d18c6cf8680f5dca8f2bfb1637487a6e074ec66b29c5a8b00b8`.
  It differs from the thumbnail because the normal image pipeline resizes and
  converts thumbnails to JPEG; this is expected, not a mismatch.
- Read-only, whole-row count/digest snapshots of **pre-existing** saved meals,
  recovery jobs, media assets and image-cache rows matched before and after
  generation and after redisplay. Only the new, isolated media/cache rows were
  excluded from those baseline comparisons. Redisplay did not alter the new
  media record or the dispatch receipts.
- Visual inspection of the persisted display image showed a layered chia
  parfait with blueberries, strawberries and coconut flakes. There was no
  visible granola or nuts. A photograph cannot prove whether a white chia base
  contains coconut milk rather than yogurt, so visual fidelity is qualified
  accordingly.

The application logged a `lifecycle_violation` **detection** when its
pre-existing safety logger saw the generated base64 PNG entering canonical
ingestion. Canonical processing then completed successfully, stored permanent
image variants and returned only a verified persistent URL; no base64 appeared
as the client's image URL. No recovery job ran.

## Stop state and remaining compatibility boundary

The Development-only diagnostic environment settings were removed after the
test, preventing reactivation on a later restart. The **already-running**
backend retains its launch-time configuration until a separately coordinated
restart, but this run's two one-shot receipts are spent and its synthetic
bearer credential is revoked. No second restart or paid request was made.

Normal application clients receive both the legacy `imageUrl` and typed
`imageResult` for this verified photograph. This server test does not certify
an installed iOS bundle: older installed clients can still have their bundled
timeout or placeholder-display behavior until separately approved native work.

The redacted machine-readable evidence and local image copies are under
`generated-artifacts/stage3c1/` (ignored by Git and deployment). Receipt
files remain under `generated-artifacts/development-image-tests/`; do not
remove them to rerun the test.
