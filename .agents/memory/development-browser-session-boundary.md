---
name: Development browser session boundary
description: The agent's app screenshots do not inherit the user's authenticated Development preview session.
---

An app-preview screenshot can show a signed-out page even when the user has signed in to their own Development preview. Do not treat the screenshot's authentication state as evidence about the user's session or assume its cookies can be reused for API requests.

**Why:** In this project, the user signed into their approved test account and the browser logs recorded a successful login, while a fresh app-preview screenshot still reported no valid authentication.

**How to apply:** Check the agent-controlled browser's own authenticated state before live testing; do not guess credentials, reuse someone else's account, or claim live save/reload verification from an isolated screenshot. If no authorized browser session is available, report the limitation.

For controlled API tests using a newly signed-up account, establish the authenticated session **after** the final Development workflow restart. A cookie obtained before the restart may no longer identify the account on the generation route, even if a protected profile read previously succeeded. Verify the generation route's authenticated identity, not just a profile read, before concluding the feature failed. Keep any test credentials and session files out of the workspace and remove temporary copies after use.

Treat the embedded workspace preview and the top-level published Development app as separate browser-cookie contexts when verifying MFA.

**Why:** The user reported successful MFA on published Development but a lost pending challenge in the workspace iframe. A top-level login result therefore does not establish that the iframe password-to-MFA transition works.

**How to apply:** Check challenge-cookie continuity in the embedded context without disabling MFA or CSRF. Distinguish isolated transport fixtures from a completed real-account MFA login, and state any verification limitation.

For a small front-end-only correction, isolated browser rendering of the real component with mocked read-only responses can verify responsive layout and UI handoffs without creating accounts or writing shared data. It does not certify authenticated generation or real board persistence.

**Why:** A fresh app screenshot captured only startup, while real-component browser checks could exercise destination guidance at desktop and mobile sizes without using the user's session.

**How to apply:** Report component-level browser checks separately from signed-in end-to-end results. Never describe a callback fixture as proof that a real meal was generated or stored.