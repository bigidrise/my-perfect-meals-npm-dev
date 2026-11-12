---
name: Production image differential diagnosis
description: How to distinguish a production storage-binding outage from stale or invalid saved-meal image records.
---

The first production image check must use one identical, known-good object path from development and production. A production `200 image/*` for that object proves the route and at least one storage binding work, but does not prove that the production user's saved-meal URLs point to the same bucket, object, or media asset variant.

**Why:** A prior production incident showed a disconnected/empty storage binding, while a later direct test succeeded after the resource was reattached. Treat historical 503 findings as time-bound and recheck the exact current object before changing image architecture.

**How to apply:** Compare the authenticated production saved-meal response, `saved_meals.meal_data.imageUrl`, `media_assets` URLs/status, and browser GET status against the same development record. If the exact object succeeds in both environments, investigate production row/URL divergence before storage code.

When exact images deliver successfully and reopening a builder restores them, investigate the display lifecycle before regenerating images or rewriting shared media references. Recovery ownership and decoded-image visibility are separate concerns.

**Why:** Studio images disappeared while the client's images remained visible; the published server delivered both original objects successfully. Metadata refreshes could hide retained, already-loaded images without another browser load event.

**How to apply:** Preserve visibility for an unchanged decoded image while still invalidating obsolete owner-scoped recovery requests. Check cached-image completion as well as load events; never weaken recovery authorization to repair a display reset.

Check for stale negative lifecycle state even when the exact saved image delivers successfully. A persisted failure flag is not proof that the original image bytes are currently missing.

**Why:** Saved Meals hid images whose exact stored URLs returned valid JPEGs because an earlier delivery-recovery check had marked their shared media records failed. The failure flag then prevented a fresh browser load.

**How to apply:** Compare the original stored reference, current delivery result, lifecycle state and API-exposed URL before proposing regeneration or storage changes. Preserve the recipe and image identity; do not broadly reset shared media records or infer why the earlier probe failed without evidence. Viewing a saved image must remain read-only: retries and surviving alternate variants belong to that view, not a rewrite of shared lifecycle state or canonical references. Genuine ingestion failures must remain distinct from stale delivery misses.