---
name: Voice message queue integrity
description: Pending voice notes must have both stored audio and a queued transcription job.
---

Treat a pending voice note without both a stored audio object and a transcription job as an unrecoverable failed upload, not a transcribing message.

**Why:** A flow that persists a placeholder before storage and queue creation can leave a permanent pending row with no bytes or job for a worker to process.

**How to apply:** Upload audio first, confirm the private object is available, then atomically persist its storage reference and transcription job. If persistence or queuing fails, remove the fresh object and write a visible failed state. In readers, only show transcription progress for pending notes that have a stored audio reference and job.

A successful storage upload response alone is insufficient evidence that a private voice object can be played or transcribed.

**Why:** a stale database reference can otherwise make a completed transcript appear playable even when the underlying audio object is already unavailable.

**How to apply:** verify availability before persisting a new note; on playback, distinguish a missing object from a temporary storage outage and preserve any completed transcript rather than fabricating replacement media.

Processing jobs must also use a durable renewable lease plus a claim token. On expiry, fail the job and its pending note together; never let a late worker overwrite that terminal recovery state.

**Why:** A process crash after claiming work otherwise leaves a job permanently `processing`, with no safe signal for a replacement worker to distinguish it from live transcription. An old pending job can also become actively processed immediately before a recovery pass, so creation time is not evidence that its current worker is stalled.

**How to apply:** Renew the lease during long-running audio work and guard every completion or retry update with the original claim token. Reclaim only expired processing leases, treat missing leases on historical processing jobs as expired, and leave object references intact when recovery marks a note failed.
