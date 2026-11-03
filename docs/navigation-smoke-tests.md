# Phase 3 — Five critical navigation smoke tests

Run against the existing Development application:

```sh
npm run test:navigation-smoke
```

Use the existing `E2E_BASE_URL` setting if the Development URL differs from the
Playwright configuration's default. The command uses the existing Chromium
project, one worker, no retries, and ignored `generated-artifacts/navigation-smoke`
output. No browser framework or application route is added.

## Exact coverage

1. Body Composition's **Back to Macro Calculator** button → `/macro-counter`,
   with calculator input or action visible.
2. Existing Copilot selection on `/glp1-hub` → `/glp1-meal-builder`,
   with builder content and an action visible under unchanged access controls.
3. Personal Biometrics return button, entered through the existing
   `from=beachbody-meal-board` link contract → `/beach-body-meal-board`,
   with builder content and an action visible. This does not save a day or
   impersonate a professional/client session.
4. Signed-out `/home` **Quick Demo** → `/guest-builder`, with a guest action
   available and no fabricated authenticated identity.
5. Pricing's visible **Terms of Service** button → `/terms`, with legal content.

Every case clicks the originating UI control, checks the destination URL, rejects
the Not Found screen, and checks destination content/action. Missing originating
controls and unintended redirects fail; tests do not substitute direct destination
visits for clicks.

## Account and safety boundaries

The three member cases use the existing dedicated account via normal sign-in,
using the existing `PAIRING_SMOKE_TEST_EMAIL` and `PAIRING_SMOKE_TEST_PASSWORD`
secrets. Never put their values in code, reports, or command-line arguments.
Traces, screenshots, and video are disabled for this spec. No authentication,
subscription, clinical, or account-ownership responses are mocked or overridden.

Unavailable credentials/sign-in or unfinished onboarding explicitly skip the
protected cases; a skip is **blocked coverage, not a pass**. Insufficient feature
access cannot be repaired by changing the account. After sign-in, non-read API
requests are blocked, not executed; failures caused by a required write must be
reported as a limitation of read-only coverage.

Do not generate food, submit clinical settings, create accounts, or expand this
suite to other routes. The suite is not evidence of nutrition correctness,
save/reload persistence, native notification behavior, or iOS safe-area handling.
It is not wired into broader validation automatically. Phase 4 remains separate.
