---
name: Customer release identity
description: Contract separating technical build identity from customer-facing announcements and dismissal.
---

A customer release is one coherent record: `releaseId`, `releasedAt`, and non-empty customer notes change together. Technical build version, SHA, timestamp, and environment may change independently and must never trigger or rename a customer announcement.

**Why:** Comparing build timestamps while preserving an old release ID caused new deployments to show stale notes or remain hidden by an old dismissal.

**How to apply:** Bake the current customer release ID into each browser bundle, compare it with the deployed manifest ID, key dismissal by release ID, and require public/dist manifest parity during Production builds. Create releases explicitly; never convert raw commit history into public notes.