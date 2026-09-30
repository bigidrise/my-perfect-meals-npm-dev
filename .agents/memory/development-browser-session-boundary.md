---
name: Development browser session boundary
description: The agent's app screenshots do not inherit the user's authenticated Development preview session.
---

An app-preview screenshot can show a signed-out page even when the user has signed in to their own Development preview. Do not treat the screenshot's authentication state as evidence about the user's session or assume its cookies can be reused for API requests.

**Why:** In this project, the user signed into their approved test account and the browser logs recorded a successful login, while a fresh app-preview screenshot still reported no valid authentication.

**How to apply:** Check the agent-controlled browser's own authenticated state before live testing; do not guess credentials, reuse someone else's account, or claim live save/reload verification from an isolated screenshot. If no authorized browser session is available, report the limitation.

For controlled API tests using a newly signed-up account, establish the authenticated session **after** the final Development workflow restart. A cookie obtained before the restart may no longer identify the account on the generation route, even if a protected profile read previously succeeded. Verify the generation route's authenticated identity, not just a profile read, before concluding the feature failed. Keep any test credentials and session files out of the workspace and remove temporary copies after use.