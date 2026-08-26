---
name: Failed Studio video deletion
description: Manual deletion rules for unusable Studio videos whose transcription or moderation failed.
---

A Studio video whose transcription or moderation failed may be manually deleted when its private media object still exists. Its permanent history row must remain with the existing failed or blocked transcript status; no substitute transcript may be invented. The lifecycle must allow both failed states to enter deletion, while playback remains unavailable.

**Why:** retaining unusable private media solely because no completed transcript exists traps sensitive content and makes deletion appear broken. The history record is still valuable evidence that a message attempt occurred, including when moderation blocked the content.

**How to apply:** keep completed-transcript safeguards for ready media and automatic retention. For failed-transcription media, require failed/null transcript history; for moderation-failed media, require blocked transcript history. Use the same lease, storage-delete, audit, reference-clearing, and retry safeguards as other manual deletion. A repeat delete may return successful only after confirming the terminal record has no media references.

Deletion-failure diagnostics are DEV-only server logs. They must distinguish storage deletion from a finalization guard and contain only a request ID, HTTP outcome, lease status, storage-completion flag, and sanitized SDK class/status.

**Why:** the deletion path can fail after storage work without exposing private video identifiers or content. A narrow stage fingerprint enables diagnosis without turning sensitive media metadata into durable audit data.

**How to apply:** never log object keys, signed URLs, transcript/media content, credentials, IP addresses, or account identifiers. Keep diagnostics outside lifecycle/audit persistence and do not add retries or weaken the lease guard merely to collect telemetry.
