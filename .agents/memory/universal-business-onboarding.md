---
name: Universal Business onboarding
description: Organization-owned onboarding, Day-31 restrictions, and permanent personal complimentary access boundaries.
---

Every authenticated person uses one organization setup flow. Completing setup makes the organization operational and starts exactly one organization-owned 30-day Business pilot. Retries, renaming, invitations, location changes, manager changes, ownership changes, and workspace switching must never restart that clock.

At the exact end timestamp, active Business operations and organization-sponsored downstream access stop. The organization identity, locations, memberships, data, and history remain intact, and commercial-resolution access remains available. Final Day-31 pricing and arrangement types are a separate product decision.

Permanent Complimentary Business Access is an audited, revocable administrative grant tied to immutable user identity. It only removes that person's Business paywall. It must never be inferred from a name or email, represented as a fake subscription, granted through self-service, or propagated into any organization the person manages.

Existing paid organizations and specially authorized organizational pilots retain their established state, clocks, and provenance.

**Why:** Organization identity, membership authority, personal access, and organization commercial state have different owners and lifecycles. Combining them would let personal privileges leak into managed organizations, restart trials, or destroy tenant history at expiration.

**How to apply:** Resolve selected organization membership and current organization commercial state on the server for every operational action and sponsored entitlement. Keep personal grants in a separate audited entitlement table. Allow commercial activation to replace the organization's commercial mode without replacing its UUID or original onboarding timestamps.