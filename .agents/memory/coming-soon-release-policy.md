---
name: Coming Soon presentation release policy
description: Production-visible informational pages do not authorize advisor execution or pregnancy activation.
---

The Coming Soon pages, links, branding, and subscription notices must be visible in Production builds, not hidden by Development-only gates. Existing Drink Pairing and customer entitlements remain unchanged; Pregnancy activation remains paused.

**Why:** The user explicitly approved Production-visible presentation when requesting the isolated release. This is not approval to push, merge, publish, or activate unfinished advisor services.

**How to apply:** Keep presentation independent of advisor implementations and synthetic prototypes. Validate without shared-database writes or live AI calls; never import unfinished runtime code solely to satisfy test dependencies.
