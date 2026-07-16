---
name: Clinical Business — Effective Access Architecture
description: How business membership sponsorship and personal plans interact for access tier computation
---

## Rule
Access tier is computed at runtime from two sources — never stored as a merged value in `users.planLookupKey`.

1. Active business membership (`businessMembers.status="active"` + `businesses.status="active"`) → sponsored tier (clinical/ultimate)
2. No active membership → personal plan (`personalPlanLookupKey` ?? `planLookupKey`)

`computeEffectiveAccess()` in `server/services/effectiveAccess.ts` is the single source of truth. It is called on every authenticated request inside `requireAuth` via `buildAuthUserWithEffectiveAccess()`.

## Why
The original accept route called `updateUserSubscription()` which overwrote `users.planLookupKey` with `clinical_business_monthly`. The remove route only flipped `businessMembers.status` — it never cleared the plan. Removed members kept clinical access indefinitely. This is the bug this architecture fixes.

## Personal plan snapshot
On first invite accept, the user's current `planLookupKey` is snapshotted into `personalPlanLookupKey` (one-time, idempotent). This preserves their personal plan so it can be restored when membership ends. The accept route no longer calls `updateUserSubscription` at all.

## How to apply
- **Never call `updateUserSubscription` from business routes.** Membership state changes only.
- `req.authUser.sponsoredByBusinessId` is non-null if the user's current session is on a sponsored seat.
- `req.authUser.sponsoredByBusinessName` is the display name of the sponsoring business.
- `requireActiveBusinessMembership` middleware (server/middleware/requireActiveBusinessMembership.ts) gates routes that require an active business membership — NOT general paid access.
- `clinical_business_monthly` is in `PAID_PLAN_KEYS` in `server/lib/accessTier.ts` so it resolves as PAID_FULL when `BILLING_ENFORCED=true`.

## DB columns added (Phase 1 boot migration)
- `users.personal_plan_lookup_key` — snapshot of personal plan at time of first business accept
- `users.personal_entitlements` — snapshot entitlements
- `users.personal_subscription_status` — snapshot status
- `businesses.organization_id` — nullable FK to organizations table (bridge added for Phase 2)
- `businesses.independent_client_policy` — "org_only"|"allowed"|"allowed_with_disclosure" (default: allowed_with_disclosure)
