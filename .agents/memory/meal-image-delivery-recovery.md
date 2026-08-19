---
name: Meal image delivery recovery
description: How to distinguish missing Object Storage images from transient delivery failures without regenerating unnecessarily.
---

For a browser-reported failure of a `/public-objects/` meal image, use the authenticated delivery-recovery endpoint rather than treating every `img.onError` as terminal. The endpoint re-probes Object Storage, retries a transient outage only once, and uses an existing thumbnail, display, or original variant if the failed variant is genuinely missing. It must never call DALL-E as part of delivery recovery.

**Why:** Browser image errors expose no HTTP status. Without a server-side probe, a temporary 503 looks identical to a 404, and regenerating immediately can spend on an image that still exists under another canonical variant.

**How to apply:** Keep retry counts bounded at the renderer. If all canonical variants are confirmed missing, mark the media asset failed and stop returning its stale URL from saved-meal responses. Regeneration belongs to a separate, recipe-aware authoritative generation flow.