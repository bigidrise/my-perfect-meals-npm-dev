---
name: ProCare access policy consistency
description: Canonical decision rules for professional Studio access across subscriptions and business sponsorship.
---

## Rule

All Professional Studio access decisions must use the canonical Studio policy
with a user's **effective** access, never a raw `users.planLookupKey`.

- Personal Ultimate remains distinct from professional Studio access.
- Clinical Business allows the personal business owner and sponsored clinical
  roles (owner, coach, trainer, physician), but not sponsored staff or
  administrators.
- Founder/internal access must remain explicit even if effective access uses a
  synthetic Ultimate plan identity.
- UI eligibility, route gates, provider invitation/connection flows, and
  subscription entitlement writes must stay aligned to the same product policy.

**Why:** Business membership sponsorship can supply Clinical access without
changing a provider's personal plan. Raw plan checks either reject valid
sponsored professionals or, if broadened, grant Studio access to every
sponsored seat. Independent plan lists also caused the UI to advertise access
that the API rejected.

**How to apply:** When adding a Studio-facing route, provider flow, or plan
product, resolve effective access first and reuse the shared policy. Add the
product to the shared catalog and extend the production-mode policy matrix;
do not create a local ProCare plan-key list.