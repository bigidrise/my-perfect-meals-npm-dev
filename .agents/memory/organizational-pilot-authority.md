---
name: Organizational pilot authority
description: Durable ownership, capacity, timing, and entitlement boundaries for Business organizational pilots.
---

An organizational pilot extends the existing Business organization; it never creates a parallel organization identity or consolidates the tenant/branding organization model.

Professional seats and client capacity are permanently separate allocations. Client capacity authorizes later enrollment and is not a requirement to pre-create users.

One organizational pilot owns the shared start and end timestamps. Normal commercial pilot access requires an active pilot, active participation, and current time inside that window. Preparing grants no normal commercial entitlement.

Pilot Champion authority is an exact-user organizational authorization, not a participant role that can be requested through an ordinary team invitation. Existing and new users claim through different entry paths, then converge on the same Business organization, pilot, and Champion authority. Champion administration and participant commercial entitlement remain independent permissions.

Each complimentary organization requires its own founder/admin-issued, email-bound authorization. An authorization is single-use and becomes permanently bound to the business it creates; multiple organizations require multiple explicit authorizations, never a reusable pilot-user bypass.

Development founder testing is the narrow exception: a trusted server-side administrator may repeatedly create independent complimentary test organizations without Stripe or consuming pilot authorizations. This bypass must never activate in Production.

An active organizational-pilot membership may elevate commercial product entitlements only. It must not infer ProCare, clinical credentials, care relationships, or Business administration; owner/admin membership remains the separate management authority.

**Why:** Clinics and gyms can support far more clients than professionals, and participant-level clocks, placeholder users, synthetic paid plans, email-domain administration, or production unlimited free-organization flags do not scale or preserve billing and administrative authority. Founder testing still needs the real pilot-facing setup experience.

**How to apply:** Keep Stripe and paid Business flows unchanged. Resolve complimentary mode on the server. Founder/admin self-service may issue and revoke unused authorizations, but normal pilot creation must lock and consume one exact authorization. Keep Development founder bypass explicit and environment-gated. Store pending invitations without users, associate real accounts only on acceptance, and leave role, ProCare, care-team, and client relationships as independent authorities.