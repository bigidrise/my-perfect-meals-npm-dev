---
name: Development browser session boundary
description: The agent's app screenshots do not inherit the user's authenticated Development preview session.
---

An app-preview screenshot can show a signed-out page even when the user has signed in to their own Development preview. Do not treat the screenshot's authentication state as evidence about the user's session or assume its cookies can be reused for API requests.

**Why:** In this project, the user signed into their approved test account and the browser logs recorded a successful login, while a fresh app-preview screenshot still reported no valid authentication.

**How to apply:** Check the agent-controlled browser's own authenticated state before live testing; do not guess credentials, reuse someone else's account, or claim live save/reload verification from an isolated screenshot. If no authorized browser session is available, report the limitation.