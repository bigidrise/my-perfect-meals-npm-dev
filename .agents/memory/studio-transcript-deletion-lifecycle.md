---
name: Studio transcript deletion lifecycle
description: Guardrails for removing a private Studio video transcript and message record.
---

Private Studio video media deletion and transcript/message deletion are intentionally separate actions. The message record may be removed only after the media is terminally deleted, its original object key is cleared, and no derivative references remain. Do not permit transcript-only removal while playable media remains.

**Why:** Playback, moderation, expiry, and storage-purge protections rely on a completed message/transcript record while private media exists. Deleting the parent first can cascade the media row while storage is still referenced.

**How to apply:** Keep media deletion as the first action. Only expose and authorize the final record-deletion action after the terminal media guard passes; preserve metadata-only audit history after the message row is gone.