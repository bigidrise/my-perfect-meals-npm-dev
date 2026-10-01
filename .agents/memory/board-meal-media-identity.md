---
name: Board meal media identity
description: Durable identity and authority rules for meal images persisted to Weekly Board.
---

Weekly Board meal images must retain canonical media identity through finalization, handoff, persistence, reload, and recovery. A `/public-objects/` prefix alone is not evidence that an object belongs to the active storage authority or is readable.

**Why:** Development and Production both persisted fresh `ready` media records and URL-only Board items that referenced missing or detached-bucket objects. Once delivery failed, the Board had no durable identity with which to repair the exact meal.

**How to apply:** Preserve `mediaAssetId` beside `imageUrl`; validate configured storage authority and object availability before cache reuse or `ready` promotion; authorize recovery against the exact owner, Board, date, slot, meal, and expected reference; update only that item atomically.

An image belonging to another runtime's bucket needs a local display recovery, not a canonical Board-reference replacement. Preserve the other environment's existing reference.

**Why:** Development and Production share Board rows but have separate writable image buckets. Persisting a DEV-only replacement into that shared row can break Production's image delivery.

**How to apply:** For an inactive-bucket reference, return the cached/regenerated image for the current display without replacing the Board's canonical image or media identity. Same-environment missing-image recovery may still persist an authorized atomic repair.