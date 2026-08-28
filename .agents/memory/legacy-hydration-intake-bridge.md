---
name: Legacy Hydration intake bridge
description: Single-source and provenance rules for representing protected legacy water intake in the gated Hydration domain.
---

Until a Hydration persistence migration is explicitly approved, `water_logs` remains the sole stored source for manual water intake. Canonical Hydration consumers may use a deterministic read-through projection marked `legacy_manual`; they must not create a second independently editable record.

**Why:** The richer Hydration schema is deliberately gated. Dual writes or an unapproved backfill would introduce drift, stale corrections, duplicate totals, and rollback risk while the protected water logger is still active.

**How to apply:** Preserve the legacy row ID as source provenance and idempotency identity, preserve normalized mL exactly, label any reconstructed unit amount and timezone interpretation, and reflect source corrections/deletions immediately. Do not infer nutrients, contribution, targets, progress, clinical context, or the original actor when legacy storage did not capture them.