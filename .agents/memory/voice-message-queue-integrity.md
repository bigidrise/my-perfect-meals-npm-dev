---
name: Voice message queue integrity
description: Pending voice notes must have both stored audio and a queued transcription job.
---

Treat a pending voice note without a stored audio object as an unrecoverable failed upload, not a transcribing message.

**Why:** The voice flow persists a placeholder before storage and queue creation. An interrupted upload can otherwise leave a permanent pending row with no bytes or job for a worker to process.

**How to apply:** On storage or queue setup failure, move the placeholder to a visible failed state. In readers, only show transcription progress for pending notes that have a stored audio reference.