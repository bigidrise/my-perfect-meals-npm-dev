---
name: Entitlements computed from planLookupKey in profile endpoint
description: The DB entitlements column is empty for all regular subscribers; profile endpoint must compute entitlements from planLookupKey via PLAN_FEATURES, not the raw DB column.
---

## The Rule

`/api/user/profile` must compute entitlements by merging:
1. `getEntitlementsForTier(getTierForLookupKey(user.planLookupKey))` — tier-based features
2. `user.entitlements` DB column — ProCare addon entitlements (procare, care_team, lab_metrics)
3. When `BILLING_ENFORCED !== "true"` — inject `"FULL_ACCESS"` to open all client gates pre-launch

**Why:** The DB `entitlements` column is only explicitly populated for ProCare accounts (on account creation). All regular subscribers (mpm_ultimate_monthly, mpm_premium_monthly, etc.) have `{}` in that column. The client-side gates (pregnancy, performance, grocery_coach, etc.) all read `user.entitlements` from the profile response. Without computing from planLookupKey, every feature gate silently blocks paid users even though the server middleware allows them.

**How to apply:** Any new entitlement-gated feature added to `PLAN_FEATURES` in `shared/planFeatures.ts` will automatically propagate to the client via this fix — no DB updates or additional code needed. ProCare-specific entitlements remain additive via the DB column merge.

**The fix location:** `server/routes.ts`, `/api/user/profile` endpoint, the `entitlements:` field in the `res.json()` call.
