---
name: Saved-image viewing safety
description: Viewing saved meals must not authorize generation or persistent image repair.
---

Favorites and other saved-meal viewing operations must be non-destructive. Image-loading failures must not automatically initiate AI generation, image replacement, cache invalidation, recovery jobs, or saved-meal/media mutations. Display-only retries and suggestions of existing stored variants are allowed.

**Why:** The user explicitly required this boundary after automatic recovery replaced surviving original photographs with generic fallback illustrations.

**How to apply:** Keep browser image-error handlers and delivery diagnostics read-only. Future repair needs a separately approved server-controlled operation, authoritative absence checks that distinguish storage uncertainty, and independently verified replacement bytes. Do not globally resume historical image-recovery jobs on startup. Restart, release, storage copying, and restoration require separate approval.
