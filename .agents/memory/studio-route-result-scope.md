---
name: Studio route result scope
description: Scope rules for transcription results that flow from processing through moderation and the success response.
---

The transcription result variable must be declared in the full upload-handler scope when the handler uses it after the processing `try` block. A declaration inside that `try` only fixes the assignment and still leaves later moderation or response code vulnerable to a local `ReferenceError`.

**Why:** A local scope error after a successful provider call can be caught and reported as a provider transcription failure, masking the real regression.

**How to apply:** When reviewing multipart transcription handlers, trace the result variable from provider assignment through persistence, moderation, and the final response; keep its declaration alive across all of those stages.