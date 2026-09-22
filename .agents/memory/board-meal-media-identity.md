---
name: Board meal media identity
description: Durable identity and authority rules for meal images persisted to Weekly Board.
---

Weekly Board meal images must retain canonical media identity through finalization, handoff, persistence, reload, and recovery. A `/public-objects/` prefix alone is not evidence that an object belongs to the active storage authority or is readable.

**Why:** Development and Production both persisted fresh `ready` media records and URL-only Board items that referenced missing or detached-bucket objects. Once delivery failed, the Board had no durable identity with which to repair the exact meal.

**How to apply:** Preserve `mediaAssetId` beside `imageUrl`; validate configured storage authority and object availability before cache reuse or `ready` promotion; authorize recovery against the exact owner, Board, date, slot, meal, and expected reference; update only that item atomically.