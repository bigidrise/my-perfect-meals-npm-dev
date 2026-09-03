---
name: Studio video purge retention
description: Safety invariant for deleting expired private Studio video media while preserving the communication record.
---

Private Studio video media has an absolute seven-day unopened limit and a 15-minute replay grace period after verified recipient completion. Expired media must be claimed with a durable, token-bound lease before storage deletion. A completed transcript remains immutable; failed, blocked, and interrupted media may be purged while their status/history remains.

**Why:** storage deletion is irreversible, but retaining unread private bytes indefinitely is also a privacy failure. A competing worker, transcript mutation, or crash between storage upload and database persistence can otherwise leave incorrect history or orphaned private objects.

**How to apply:** scheduled private-media deletion must use a per-item renewable lease, preserve and version-lock completed transcripts, delete every original/derivative first, and only then persist the terminal state with cleared references. Sweep all object-bearing states after the unopened deadline, including upload crashes; derive the deterministic key when a stranded row lacks one, and do so on every retry. Only recipients can start completion; playback and completion must enforce the absolute deadline atomically. Participant deletion hides history per viewer and never directly deletes shared media.