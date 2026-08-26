# Studio video retention impact

Studio video media remains private, authorized, and replayable only after the
video has completed transcription and moderation. Watching nearly all of a
ready video records verified watch completion and starts the existing
24-hour expiry window. This document describes that dependency; it does not
change the policy.

## Lifecycle dependencies

- The client and professional playback-progress routes are the only paths that
  turn `ready` media into `expiration_pending` and set `watchCompletedAt` plus
  `expiresAt`.
- The purge worker finds due `expiration_pending` records, marks them expired,
  leases them, removes every private original and derivative object, and only
  then clears media references and records `deleted`.
- A completed transcript and the message-history record remain after manual or
  automatic media deletion. A failed-transcription record remains failed with
  no invented transcript.
- Storage deletion failures retain object references and move the media to
  `deletion_failed` so the existing retry path can safely try again. Retries
  must not extend the original 24-hour deadline.

## UI and test impact

- Playback and progress UI must keep reporting verified progress for both
  client and professional message views; changing or removing that reporting
  would prevent the expiry timer from starting.
- Deleted and expired entries must retain their history/transcript rendering
  while blocking playback.
- Tests for retention must continue to cover verified completion, the exact
  24-hour duration, private-object deletion before database finalization, and
  retry-safe storage failures.
