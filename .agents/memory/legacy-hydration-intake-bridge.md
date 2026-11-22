---
name: Legacy Hydration intake bridge
description: Single-source and provenance rules for representing protected legacy water intake in the gated Hydration domain.
---

Until a Hydration persistence migration is explicitly approved, `water_logs` remains the sole stored source for manual water intake. Canonical Hydration consumers may use a deterministic read-through projection marked `legacy_manual`; they must not create a second independently editable record.

**Why:** The richer Hydration schema is deliberately gated. Dual writes or an unapproved backfill would introduce drift, stale corrections, duplicate totals, and rollback risk while the protected water logger is still active.

**How to apply:** Preserve the legacy row ID as source provenance, but qualify projection identity by both the owner and source record. Preserve normalized mL exactly, label any reconstructed unit amount and timezone interpretation, and reflect source corrections/deletions immediately. Do not infer nutrients, contribution, targets, progress, clinical context, or the original actor when legacy storage did not capture them.

Treat original entry amounts and legacy actors as unavailable unless actually captured; a reverse-converted display amount and the subject identity are not proof of either.

**Why:** The protected logger retains rounded milliliters and a selected unit, not the exact originally typed amount or the entering actor. A read-through adapter cannot reconstruct lost evidence.

**How to apply:** Keep those unknowns explicit in provenance. Any future capture of additional source evidence needs separate approval to change the protected logger; do not add persistence or infer evidence to satisfy a projection contract.