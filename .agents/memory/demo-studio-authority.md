---
name: Demo Studio product and authority boundary
description: Demo Studio development is paused; preserve existing walkthroughs and isolation without expansions or a separate test environment.
---

Demo Studio development is paused at its current state. Preserve all completed functionality,
including Start Fresh, Continue Demo, the Onboarding and Macro Calculator walkthroughs,
Dashboard navigation, and existing synthetic isolation protections. Do not remove, refactor,
or change existing Demo Studio functionality.

**Why:** The user says the current Demo Studio is sufficient for instructional recordings
and does not want further development time or expense now. The regular application will
be used for Meal Builders, Lifestyle, Favorites, Hydration, and other recordings.

**How to apply:** Do not implement builder presentation expansion, a separate test environment,
additional synthetic adapters, or new Demo Studio features. No code changes, GitHub pushes,
or Production deployments are authorized by this work. Revisit Demo Studio only when the
user identifies a specific future need. Earlier approvals below describe the preserved
implementation boundary, not permission to resume development.

The existing Onboarding, Macro Calculator, and Dashboard choices must remain visible,
not collapsible, including after Start Fresh and returning to or reopening Demo Studio.
Use a prominent, readable walkthrough heading rather than a small Phase 1 disclosure.

**Why:** The user could not find the preserved walkthroughs and explicitly said the choices
should not be collapsible. This visibility correction does not resume expansion.

**How to apply:** Preserve existing workflow actions and isolation; do not hide these
choices behind a dropdown or disclosure when simplifying the Studio controls.

Demo Studio is the foundation of My Perfect Meals Demo Mode: a connected customer-facing
journey using synthetic data, not three disconnected recording previews.
Onboarding must carry into the Macro Calculator and Dashboard until explicitly reset.

**Why:** The user wants repeatable recordings, presentations and training without sacrificing
their own account. Stripe Test Mode is the conceptual reference, not a claim that isolated
backend test infrastructure already exists.

**How to apply:** Keep Demo Mode separate from the future Test Sandbox capability for actual
backend workflow testing. Do not call the client-only implementation a fully functional
Stripe-style sandbox without verifying every supported workflow and side effect.

Approved Group 1 extends the existing Onboarding, Macro Calculator and Dashboard into one
Enter Demo Mode journey with normal Dashboard, Builders, Lifestyle and More navigation,
verified safe landing hubs, one persistent synthetic account, in-frame history/query strings,
a persistent indicator, Reset Demo and Return to Demo Studio. Groups 2–6 remain outside scope.
Clinical hubs may remain blocked when their required adapters cannot be safely verified.
Preserve live authentication, sessions, CSRF, authorization, subscription and clinical/pilot
behavior. No shared-database or Production access, real account edits, migrations, publishing
or GitHub pushes are authorized.

**Why:** The user approved connected Group 1 after reviewing the navigation investigation,
while explicitly retaining Development-only isolation and deferring later functional groups.

**How to apply:** Reuse actual guarded page components selectively. The user authorized
additive named exports in the existing Router only, with no edits to normal routes,
redirects or guard logic. Do not mount the full production application router inside
Demo Studio. Additional shared-code edits require specific approval. Use explicit
synthetic adapters and verify each allowed landing page; unverified destinations stay blocked.

Network isolation alone is not proof that a synthetic workflow works.

**Why:** A fail-closed adapter can pass safety tests while real customer components fail on
missing nested response fields or browser-origin assumptions in their existing URL helpers.

**How to apply:** Validate fixture responses with the real consumer parsers where available,
check the compiled Development/Production guard, and verify the connected journey through real
save controls. Keep functional evidence distinct from proof that outbound traffic was blocked.
