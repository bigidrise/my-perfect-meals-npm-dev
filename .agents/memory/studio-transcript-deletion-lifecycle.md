---
name: Studio participant deletion lifecycle
description: Viewer-specific Studio history hiding and the separate private video-media lifecycle.
---

Normal Studio trash actions are per-viewer history hides, never shared-row deletion. This applies to text, voice, video messages, and retained video transcripts. A participant can remove a message from only their own history without deleting the shared client-note row, voice job, transcript, video parent, or media references. There is no global voice-media deletion in this model.

Private video-media deletion is a distinct global action with the existing guarded object-storage lifecycle. It removes private video bytes for both participants while preserving the shared transcript/message history.

**Why:** Shared Studio rows, transcriptions, moderation, retention, and object-storage safety depend on preserving the parent record. Per-viewer tombstones support each participant’s independent history without weakening those lifecycle guarantees.

**How to apply:** Filter lists, unread counts, and playback/progress/audio access by the authenticated viewer’s tombstone. Keep normal UI copy explicit (“Delete for me”) and label the guarded video byte removal separately (“Delete video for everyone”). Preserve relationship checks, activity/audit logging, cache invalidation, and the global video-media lifecycle.