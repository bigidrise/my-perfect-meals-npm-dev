---
name: AI observability checkpoint 1
description: Privacy-safe, feature-disabled foundation constraints for later telemetry work.
---

AI observability must advance in staged checkpoints. The first checkpoint is contracts and additive persistence definitions only: telemetry stays disabled unless `AI_OBSERVABILITY_ENABLED` is literally `"true"`, has no writer/call-site instrumentation, and does not alter model routing or AI behavior.

Pricing entries are append-only/effective-dated; incomplete provider usage or pricing must produce a null estimated cost rather than a partial estimate. The telemetry allowlist intentionally excludes content, clinical context, user/account identities, and raw provider artifacts.

**Why:** Operational observability is useful only if its foundation is privacy-safe and cannot silently change AI behavior or capture user content.

**How to apply:** Later writer/adaptor and coverage work must retain the strict contracts, remain fail-open, preserve the existing model paths until separately approved, and never activate or apply the SQL artifact without a production review.