---
name: Production image differential diagnosis
description: How to distinguish a production storage-binding outage from stale or invalid saved-meal image records.
---

The first production image check must use one identical, known-good object path from development and production. A production `200 image/*` for that object proves the route and at least one storage binding work, but does not prove that the production user's saved-meal URLs point to the same bucket, object, or media asset variant.

**Why:** A prior production incident showed a disconnected/empty storage binding, while a later direct test succeeded after the resource was reattached. Treat historical 503 findings as time-bound and recheck the exact current object before changing image architecture.

**How to apply:** Compare the authenticated production saved-meal response, `saved_meals.meal_data.imageUrl`, `media_assets` URLs/status, and browser GET status against the same development record. If the exact object succeeds in both environments, investigate production row/URL divergence before storage code.