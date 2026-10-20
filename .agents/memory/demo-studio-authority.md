---
name: Demo Studio product and authority boundary
description: Connected Demo Mode is distinct from a future backend Test Sandbox; preserve the approved Phase 1 scope and isolation boundaries.
---

Demo Studio is the foundation of My Perfect Meals Demo Mode: a connected customer-facing
journey using synthetic data, not three disconnected recording previews.
Onboarding must carry into the Macro Calculator and Dashboard until explicitly reset.

**Why:** The user wants repeatable recordings, presentations and training without sacrificing
their own account. Stripe Test Mode is the conceptual reference, not a claim that isolated
backend test infrastructure already exists.

**How to apply:** Keep Demo Mode separate from the future Test Sandbox capability for actual
backend workflow testing. Do not call the client-only implementation a fully functional
Stripe-style sandbox without verifying every supported workflow and side effect.

Phase 1 authorization covers only Onboarding, Macro Calculator and Dashboard, in Development.
Additional modules are future scope, not permission to expand now. Preserve live authentication,
sessions, CSRF, authorization, subscription and clinical/pilot behavior. No shared-database or
Production access, real account edits, migrations, publishing or GitHub pushes are authorized.

**Why:** The user explicitly limited scope and required isolation; their attached clarification
retained those boundaries while asking for architecture that can be extended incrementally.

**How to apply:** New features get explicit synthetic adapters inside the existing isolation
foundation. Stop for approval before any additional shared security-sensitive changes.

Network isolation alone is not proof that a synthetic workflow works.

**Why:** A fail-closed adapter can pass safety tests while real customer components fail on
missing nested response fields or browser-origin assumptions in their existing URL helpers.

**How to apply:** Validate fixture responses with the real consumer parsers where available,
check the compiled Development/Production guard, and verify the connected journey through real
save controls. Keep functional evidence distinct from proof that outbound traffic was blocked.
