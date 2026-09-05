---
name: Browser CSRF boundary
description: Defines the durable separation between cookie-authenticated browser mutations, native bearer traffic, and signed callbacks.
---

Cookie-authenticated mutations require both an exact trusted browser origin and a per-session synchronizer token. Explicit bearer requests are not ambient-cookie requests, and signed callbacks must remain independently authenticated rather than receiving broad CSRF exemptions.

**Why:** SameSite=None is needed for supported application contexts, so the cookie alone cannot establish request intent. Credentialed wildcard deployment or browser-reachable localhost origins would also let an attacker read the token endpoint and defeat the synchronizer-token design.

**How to apply:** Register CSRF enforcement after sessions and before application routes, keep production CORS origins exact, refresh tokens after session regeneration, and exempt only explicit bearer credentials or exact callbacks that fail closed on signature verification.