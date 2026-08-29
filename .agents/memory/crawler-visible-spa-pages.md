---
name: Crawler-visible SPA pages
description: Routing and client-mount requirements for server-rendered public page snapshots in the React SPA.
---

Public marketing and legal HTML handlers must be registered before both the production boot-time fallback and the fully initialized SPA fallback. The same URL must also be allowed by every client-side authentication redirect guard, and the returned shell must retain the SPA module scripts.

**Why:** A server-rendered snapshot can look correct to a no-JavaScript crawler while still failing for people if the client redirects the route after mounting. In production, handlers registered after the early fallback are unreachable and silently return the generic shell.

**How to apply:** When adding another crawler-visible public route, update the shared server snapshot registry and all client public-route allowlists together. Verify both the raw response and the anonymous browser URL after JavaScript has mounted.