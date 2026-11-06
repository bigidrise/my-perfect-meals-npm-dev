---
name: Development Vite cache identity
description: Warm-browser module graphs can remain broken even after a successful cache regeneration and healthy server restart.
---

A healthy server, successful build, or fresh-browser screenshot does not prove an
already-open Development preview can reload its cached module graph.

**Why:** The founder's open preview failed to import the application entry after
verification/restart work. Server logs showed missing optimized dependency chunks.
Regenerating the optimizer cache retained the same browser hash, so stale cached
importers could still request obsolete chunk filenames. Giving the live preview a
separate cache URL identity allowed the entry module to load and React to mount.
The exact operation that originally produced the stale browser graph was not
established; do not attribute it to a particular test or build without evidence.

**How to apply:** When startup reports a failed dynamic import, correlate browser
errors with missing chunk requests before changing application logic or sessions.
For this failure class, ensure recovery invalidates module URL identity rather
than assuming another restart or identical cache rebuild is sufficient. Preserve
account/session data and keep recovery confined to generated Development assets.
