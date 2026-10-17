---
name: Browser CSRF boundary
description: Defines the durable separation between cookie-authenticated browser mutations, native bearer traffic, and signed callbacks.
---

Cookie-authenticated mutations require both an exact trusted browser origin and a per-session synchronizer token. Explicit bearer requests are not ambient-cookie requests, and signed callbacks must remain independently authenticated rather than receiving broad CSRF exemptions.

**Why:** SameSite=None is needed for supported application contexts, so the cookie alone cannot establish request intent. Credentialed wildcard deployment or browser-reachable localhost origins would also let an attacker read the token endpoint and defeat the synchronizer-token design.

**How to apply:** Register CSRF enforcement after sessions and before application routes, keep production CORS origins exact, refresh tokens after session regeneration, and exempt only explicit bearer credentials or exact callbacks that fail closed on signature verification.

Cookie-forwarding internal HTTP requests remain authenticated browser-session writes. They are not exempt merely because the server initiates the second HTTP request: carry the already-validated caller origin and session CSRF token, or use a direct authenticated service call instead. For accepted originless API clients, preserve the API marker and session token. Never make localhost or all internal requests a blanket CSRF exception.

**Why:** Recipe Maker's outer request succeeded, but its cookie-forwarding call to the meal generator omitted the browser security context and was rejected before generation. The user confirmed successful Development use after preserving that context; a shared-policy bypass was neither needed nor approved.

**How to apply:** When adding a server-side loopback to a protected mutation, preserve its verified session security context and test both the successful authenticated call and rejection of an untrusted external origin.

Distinguish an Editor workspace running the Production entrypoint from a published deployment when applying preview cookie policy.

**Why:** Production-mode code can still run inside a cross-site embedded workspace preview. Using NODE_ENV alone to exclude preview cookies misses that context; applying preview behavior to published deployments changes a separate security boundary.

**How to apply:** Use the platform's workspace and published-runtime signals, keep the Production entrypoint's secure baseline independent of NODE_ENV, and cover creation and clearing of matching cookies. Partitioned cookies do not replace CSRF, MFA, authorization, or durable sessions. Cookie-header and session-round-trip fixtures are not proof of real-browser cookie acceptance.