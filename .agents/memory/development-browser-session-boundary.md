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

Keep browser notebook operations short; a long wait can reset the browser and destroy its session even when the server already completed the request.

**Why:** A pairing browser check timed out while waiting for a response that Development server logs showed had completed with HTTP 503 in about 1.5 seconds. The harness timeout did not establish an application timeout.

**How to apply:** Correlate existing server completion logs before repeating a submission. Report missing final UI evidence separately from the known HTTP result, and re-establish normal authorized sign-in if a notebook reset lost the session.

Do not assume that credentials present in the shell environment are securely available to the browser notebook.

**Why:** A release-readiness check found the authorized test secrets in the shell, but the browser notebook had no `process.env` access or documented secure secret binding. The login page loaded, but this did not establish either account eligibility or authenticated access.

**How to apply:** Check the browser tooling's supported credential mechanism first. If none exists, use a supported user sign-in takeover when appropriate or report authenticated coverage as unverified. Do not bridge raw credentials through tool output, ad hoc endpoints or credential files just to complete a test.

Fixture-only testing under a strict no-backend-effects constraint requires
verified network isolation before the application starts. A fetch-only shim is
not a substitute for request interception.

**Why:** The hosted browser exposed initialization scripts and extra headers,
but not request interception/fulfillment. Injected meta-CSP probes did not enforce
the proposed policy, so they could not establish that unknown requests were
blocked.

**How to apply:** Check the current harness capabilities before promising a
synthetic signed-in review. If interception or an independently verified
equivalent is unavailable, report the browser checks as unable. Keep component
unit tests and anonymous startup screenshots separate from responsive or
authenticated browser evidence; do not create an unapproved runtime to bypass
the limitation.

Passive static markup is a separate review option: the testing browser can
load local, script-free component HTML into an about:blank document using
document.open/write. This can establish text wrapping and responsive geometry,
but not authenticated flows, persistence, interactive callbacks or eligibility.

**Why:** A bounded localization review verified real shared-component markup
and compiled CSS without loading the app, accessing customer data or weakening
Vite's intentional restriction on generated artifacts.

**How to apply:** Use only synthetic, self-contained markup with no scripts,
remote assets or application startup. State the composed-fixture limitation;
never treat this as a substitute for required full-page or write-path evidence.

Full-page API fixtures need coherent, per-identity profile state: every profile
read alias must return the updates accepted by its mocked profile writes.

**Why:** Frozen profile reads paired with echo-only writes caused a continuous
client synchronization loop during an isolated Shopping review. Returning the
same updated fixture state removed the loop without application changes.

**How to apply:** Model accepted mutations in the fixture before checking request
counts or reload behavior. Distinguish fixture synchronization failures from
application regressions, and never replace fixtures with unapproved live writes.