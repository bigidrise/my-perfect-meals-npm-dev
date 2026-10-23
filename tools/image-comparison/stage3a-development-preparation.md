# Stage 3A — Development source preparation

## Authority and activation

Phase 2D was accepted. The central registry now selects the dated
`gpt-image-2.5-flare-2026-09-08` snapshot provisionally.
Sunburst is not a fallback. No automatic switching exists.

**Paid runtime generation remains disabled.** The source requires both a
Development process and a separately approved `IMAGE_DEVELOPMENT_ACTIVATION`
value of `approved-flare`; deployment-marked and Production processes cannot
enable this preparation. No environment setting was changed. Existing verified
cache reads remain possible without activating new generation.

Do not enable that setting, restart or execute a paid diagnostic without new
explicit approval.

## Shared generation and economic boundaries

The shared generator remains the sole application image dispatch path and now
sends the tested direct Images API contract: one image, 1024 square, low quality,
explicit PNG, opaque, default/auto moderation, with SDK retries disabled.

Generation is bounded to 150 seconds, verification to 20 seconds, and the entire
operation to 180 seconds, including cache reads and foreground persistence.
New clients wait 210 seconds. Recipe-fidelity retries are limited to two total
attempts and stay inside the same overall deadline and reservation ledger.
There is no automatic retry after transport or accounting uncertainty.

Each generation/verification attempt reserves $0.25; the operation ceiling is
$0.50 and the process-local planning allowance is $5. None is a provider billing
cap. Reservations are not refunded. Reported token arithmetic is validated;
unknown, inconsistent or excessive estimated usage stops further dispatch.
Sanitized request IDs, usage counts and estimated costs are carried in typed
image results.

Uncertain operations retain recipe-keyed tombstones, including after display
cache invalidation. Late generation cannot publish, persist, cache or authorize
a second request. Late storage completion cannot publish or initiate a later
cache write. Already-dispatched storage/database operations cannot be
retroactively cancelled by an application timer: remote completion may still
occur. This remains an activation review risk, not a claim of distributed
transaction cancellation.

## Client and saved-image compatibility

- Chef's 30-second abort is replaced by the shared 210-second client deadline,
  including response-body parsing. A timed-out request is not automatically retried.
- Chef's session cache includes the full ingredient list, dish name and occasion,
  rather than reusing a same-name image for a different recipe.
- Chef consumers reject typed unverified results and known fallback artwork.
  The shared image slot presents known artwork as unavailable, not a photograph.
- Permanent-image classification excludes known placeholders, and incoming
  placeholders cannot replace an existing photograph through the shared guard.
- Both image endpoint registrations retain the legacy `imageUrl` field. It is
  null for placeholders/unavailable verification and a photograph URL on verified
  success, protecting older clients that ignore the new typed evidence.
- URL-only responses from older servers remain display-compatible for
  non-placeholder URLs. They cannot retrospectively prove verification.
- No Favorites-view generation, saved-image repair, restoration or recovery was
  enabled. Existing stored photographs and cache identity protections remain.

### Installed iOS

`capacitor.config.json` uses bundled-first startup with `client/dist`; it has no
remote startup URL. Updating or publishing server/web code does not update an
installed binary's bundled Chef hook. Existing iOS binaries can retain their
old 30-second timeout, placeholder classification and UI until an explicitly
approved bundle build/sync and native release.

The API's legacy URL field remains present and no longer supplies placeholder
artwork as a photograph URL. Server-side in-flight joining and durable verified
cache reads reduce duplicate work if an older native client abandons a request.
This is not a device-level compatibility certification. No native bundle build,
sync, installed-device test, restart or release was performed.

## Retirement monitoring prepared, not activated

The daily review service has no timer, bootstrap import, persistence or notifier.
It reviews Flare, GPT-4o, GPT-4o-mini, GPT-5 and Whisper-1. Callers must also supply
any dynamically configured active IDs (including an OPENAI_TEXT_MODEL override).
The tested-but-inactive Sunburst model is deliberately absent.

It prepares owner-alert drafts at 90, 60, 30, 14, 7 and 1 day, catches the nearest
missed warning window, detects retirement and permanent model-unavailable errors,
and accepts delivered keys for deduplication. It neither sends alerts nor changes
models. Missing shutdown metadata is unknown, not proof that a model never retires.
Catalog retrieval does not prove successful generation.

Before scheduler activation, independently review provider shutdown schedules,
resolve configured active IDs, supply a real owner destination and durable
successful-delivery keys, and approve scheduling/notifications separately.

## Verification and remaining activation risks

All generation, vision, database and storage interactions in selected pipeline
tests are mocked. Tests cover the request contract, unchanged frozen comparison
prompts, recipe fidelity, cache identity, typed placeholders, older-client
responses, saved-image immutability, spending, deadlines, late results and model
monitoring. No live provider diagnostic is part of verification.

The committed Phase 2C manifest remains historical and byte-unchanged.
The freeze test still checks actual current builder/validator prompt bytes
against that baseline; whole-file historical fingerprints are not regenerated
by ordinary tests merely because non-prompt runtime code changes.

Remaining release boundaries:

1. No paid end-to-end test of the application Flare/verification/storage path
   was authorized. Phase 2D tested the isolated comparison, not this application.
2. Comparison prompts included preparation/yield evidence not currently accepted
   by the general application builder. Runtime fidelity is not established by
   the comparison or mocked tests alone.
3. Token charges are estimates, and the ledger/tombstones are process-local:
   process replacement, multiple workers and provider billing reconciliation
   require separate activation review.
4. Already-dispatched persistence is not a cancellable distributed transaction.
5. Installed native bundles need a separately approved release and device check.
6. Shutdown metadata can be absent; monitoring cannot invent dates or establish
   provider availability. Scheduler and owner notification activation are pending.
7. Full-root TypeScript has a reviewed baseline of 120 existing diagnostics.
   Targeted source checks must not be described as a clean whole-project build.

No paid image requests, real database/storage changes, saved-photo recovery,
restart, publishing, deployment or Production changes were performed in this stage.
