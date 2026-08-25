---
name: Studio video purge retention
description: Safety invariant for deleting expired private Studio video media while preserving the communication record.
---

Expired Studio video media must be claimed with a durable, token-bound lease before storage deletion. The completed transcript must become immutable when expiration begins, and finalization must still confirm the transcript is present before clearing the media references.

**Why:** storage deletion is irreversible. A competing worker or transcript mutation during deletion can otherwise leave an incorrect lifecycle record or destroy the only media before a transcript is durably retained.

**How to apply:** scheduled and manual private-media deletion must use a per-item renewable lease, make the retained record immutable (or version-locked) before object deletion, delete every original/derivative first, and only then persist the terminal state with cleared references. Manual deletion must first gate playback through its deleting state; scheduled retry eligibility remains tied to the original expiration deadline.