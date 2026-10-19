---
name: Crawler-visible SPA pages
description: Routing and client-mount requirements for server-rendered public page snapshots in the React SPA.
---

Public marketing and legal HTML handlers must be registered before both the production boot-time fallback and the fully initialized SPA fallback. The same URL must also be allowed by every client-side authentication redirect guard, and the returned shell must retain the SPA module scripts.

**Why:** A server-rendered snapshot can look correct to a no-JavaScript crawler while still failing for people if the client redirects the route after mounting. In production, handlers registered after the early fallback are unreachable and silently return the generic shell.

**How to apply:** When adding another crawler-visible public route, update the shared server snapshot registry and all client public-route allowlists together. Verify both the raw response and the anonymous browser URL after JavaScript has mounted.

## Public HTML and application startup are separate purposes

Retain the public marketing HTML for crawlers and no-JavaScript visitors, but present the existing My Perfect Meals logo while the interactive application starts. A branded startup layer must end on a committed React render, not merely a downloaded entry module, and must expose actionable bootstrap failures or bounded timeouts.

**Why:** The user reported promotional Lifestyle text appearing as an unbranded, unsafe-area loading screen after full-document navigation. They explicitly requested preserving the SEO work while separating the customer startup experience, initially in Development only.

**How to apply:** Use internal routing for in-app return links. Keep startup presentation independently Development-gated until release is approved, preserve crawler text and entry scripts, account for all device insets, and verify both JavaScript-enabled startup and no-JavaScript readability. Never replace a visible startup error with an indefinite logo.

Startup recovery controls must be usable before `DOMContentLoaded`.

**Why:** A browser check found that a stalled module request can hold that event indefinitely, leaving already-visible recovery buttons inert if their handlers are registered only then.

**How to apply:** Register recovery interaction handling independently of module readiness, and test timeout recovery while the document lifecycle event is still blocked.