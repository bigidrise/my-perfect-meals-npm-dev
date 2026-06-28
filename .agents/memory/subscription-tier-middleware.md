---
name: Subscription Tier Enforcement — Middleware Pattern
description: How the 4-tier paywall is enforced on the backend and frontend; which middleware to use for each tier; edge cases.
---

## The Rule

The backend enforces subscription tiers using three middleware files derived from `shared/planFeatures.ts` as the single source of truth. Always add the appropriate middleware when adding a new paid route.

| Tier | Middleware | File |
|------|-----------|------|
| Essential (any paid) | `requireEssentialAccess` | `server/middleware/requireEssentialAccess.ts` |
| Pro or Clinical | `requireProAccess` | `server/middleware/requireProAccess.ts` |
| Clinical only | `requireClinicalAccess` | `server/middleware/requireClinicalAccess.ts` |

## Tier → Plan mapping (from planFeatures.ts)

- `basic` → Essential
- `premium` → Pro
- `ultimate` → Clinical

Determined via `getTierForLookupKey(planLookupKey)` from `shared/planFeatures.ts`.

## Edge cases

- **BILLING_ENFORCED=false** (pre-launch mode): all three middleware pass everyone. Same logic as `requireActiveAccess` / `resolveAccessTier`.
- **TRIAL_FULL** (accessTier): trial unlocks all tiers — passes Essential, Pro, AND Clinical.
- **null planLookupKey + PAID_FULL**: internal account (founder, sandbox). Grant all tiers. `resolveAccessTier` gives them PAID_FULL for other reasons; `getTierForLookupKey(null)` would return "free" and incorrectly block — so the middleware explicitly allows null planLookupKey when accessTier is PAID_FULL.
- **isSandbox**: also explicitly passed at all tiers.

## Frontend guards (Router.tsx)

| Guard | Function | Tier |
|-------|----------|------|
| `PaywallGuard` | `hasActivePaidSubscription()` | Essential+ |
| `ProGuard` | `isProOrAbove()` | Pro+ |
| `ClinicalGuard` | `isClinicalOrAbove()` | Clinical only |

## Feature → Tier mapping (as of this implementation)

**Essential:** Saved Meals, Shopping List, Weekly Meal Planner, Create a Dish, Fridge Rescue (unlimited), Snack Creator, Builders, Biometrics

**Pro:** Craving Creator, Dessert Creator, Beverage Creator, Sushi Creator, Restaurant Guide, Gatherings, Chef Pairings, Creator Studio, Grocery Coach, My Perfect Pets

**Clinical:** Performance Nutrition, My Perfect Pregnancy, My Perfect Getaway, Therapeutic Nutrition, Lab Metrics, Care Team

## Why

Before this fix, the backend only had two states: "logged in" (`requireAuth`) and "any paid" (`requireActiveAccess`/`requirePremiumAccess`). An Essential subscriber could call Pro or Clinical API endpoints directly, bypassing frontend guards. The fix adds proper tier enforcement on the server so plan enforcement holds even when users call APIs directly.
