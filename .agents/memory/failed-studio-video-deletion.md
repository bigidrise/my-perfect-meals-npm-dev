---
name: Failed Studio video deletion
description: Manual deletion rules for unusable Studio videos whose transcription failed.
---

A Studio video whose transcription failed may be manually deleted when its private media object still exists. Its permanent history row must remain with the existing failed transcript status; no substitute transcript may be invented. The lifecycle must allow the failed-transcription state to enter deletion, while playback remains unavailable.

**Why:** retaining unusable private media solely because no completed transcript exists traps sensitive content and makes deletion appear broken. The history record is still valuable evidence that a message attempt occurred.

**How to apply:** keep completed-transcript safeguards for ready media and automatic retention. For failed-transcription media, use the same lease, storage-delete, audit, reference-clearing, and retry safeguards as other manual deletion. A repeat delete may return successful only after confirming the terminal record has no media references.