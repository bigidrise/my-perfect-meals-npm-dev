---
name: Voice message queue integrity
description: Pending voice notes must have both stored audio and a queued transcription job.
---

Treat a pending voice note without both a stored audio object and a transcription job as an unrecoverable failed upload, not a transcribing message.

**Why:** A flow that persists a placeholder before storage and queue creation can leave a permanent pending row with no bytes or job for a worker to process.

**How to apply:** Upload audio first, then atomically persist its storage reference and transcription job. If persistence or queuing fails, remove the fresh object and write a visible failed state. In readers, only show transcription progress for pending notes that have a stored audio reference and job.