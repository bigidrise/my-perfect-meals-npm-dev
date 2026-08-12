---
name: Meal Share System
description: Public meal sharing — architecture, attribution flow, and key implementation details
---

## Architecture

**Share token**: 8-char `base64url` via `crypto.randomBytes(6)`.

**Table**: `meal_shares` (share_token PK, user_id, meal_name, meal_description, meal_image, calories, protein, carbs, fat, created_at). Boot migration in both `server/index.ts` and `server/prod.ts`.

**Server routes**: `server/routes/mealSharesRouter.ts` — mounted at TWO paths:
- `POST /api/meals/share` (requireAuth) — creates share record, checks `user_affiliate_accounts` for active affiliate (`activatedAt` + `rewardfulReferralToken` both non-null), appends `?via=TOKEN` to URL for affiliates.
- `GET /api/share/:token` (PUBLIC) — returns safe meal data only (no userId).

**Frontend public page**: `client/src/pages/SharedMealPage.tsx` at route `/m/:shareToken`.

## Critical: AppRouter public route list

`client/src/components/AppRouter.tsx` line ~106 has a `publicRoutes` array that controls auth redirect bypass. Any new public route MUST be added here or unauthenticated users get bounced to `/welcome`. Added `/m` to this list.

## Rewardful attribution flow

1. Affiliate `rewardfulReferralToken` stored in `user_affiliate_accounts.rewardful_referral_token`.
2. Share URL for active affiliates: `https://domain.com/m/TOKEN?via=AFFILIATE_TOKEN`
3. `index.html` already loads Rewardful script with `data-rewardful="efb377"` — it reads `?via=` param automatically and sets `rw_ref` cookie on page load.
4. At checkout, `getRewardfulReferral()` in `checkout.ts` reads the cookie and sends referral ID to Stripe as `client_reference_id`.
5. Attribution survives across sessions because it's cookie-based.

## ShareRecipeButton behavior (3-tier)

1. **Native (Capacitor)**: `@capacitor/share` → native iOS/Android share sheet.
2. **Web with `navigator.share`**: Web Share API → native macOS Safari/Android share sheet.
3. **Desktop fallback** (Chrome/Firefox on Mac): `SharePanel` modal — Copy Link, Email, Copy Recipe.

**Why:** `navigator.share` is NOT supported in Chrome or Firefox on Mac/Windows. Previously fell back to silent clipboard copy with no feedback. Now opens `SharePanel` instead.

## Components

- `client/src/components/SharePanel.tsx` — desktop share modal (Copy Link / Email / Copy Recipe)
- `client/src/pages/SharedMealPage.tsx` — public preview page (no auth)
- `server/db/schema/mealShares.ts` — Drizzle schema

## Phase 2 (deferred): Share with Client

ProCare coaches push meal to client's board. Come back with workflow + data model proposal before building.
