---
name: Studio loading release boundary
description: Development-only approval and permission-cache limits for Studio, Pro Portal, and Care Team loading corrections.
---

The user approved the first-pass Studio / Pro Portal / Care Team loading corrections for Development only. Production behavior must remain unchanged unless separately authorized. Do not introduce cross-navigation permission caching.

**Why:** The approval explicitly limited the work to Development source corrections and isolated tests, with application restart and Production changes requiring separate approval.

**How to apply:** Keep the corrected loading and verification path Development-gated. Page-code reuse is not permission reuse; verify workspace, agreements, and certification afresh on navigation. Do not infer restart or release permission from completion of the source work.
