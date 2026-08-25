---
name: Role-aware polling authentication
description: Background polling must distinguish a revoked session from an authenticated user's role-boundary response.
---

Never globally sign out a user solely because a background request receives a 401 or 403. The request must be one whose authorization contract proves that those statuses mean the current session itself is invalid.

**Why:** A professional dashboard poll was sent to a client-only route. The valid professional session correctly received an access denial, but a generic polling handler interpreted it as token revocation and forced a page reload/sign-out loop.

**How to apply:** Keep fatal session invalidation limited to a dedicated session probe or endpoints whose authorization applies to every caller in that polling context. For role- or workspace-scoped polls, surface access errors locally and verify the endpoint matches the active role before starting the interval.