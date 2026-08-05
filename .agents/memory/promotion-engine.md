---
name: Promotion Engine
description: Architecture and decisions for the MPM Promotion Engine (partner_promotions, promotion_redemptions tables, API, UI).
---

## The Rule
All partner offers — trials, discounts, beta, founding, VIP — flow through one engine. Stripe handles payment, Rewardful handles attribution, MPM owns the business rules.

## Tables
- `partner_promotions` — owner_user_id (text), type ('extended_trial'|'discount'), invite_token (md5 default), stripe_coupon_id / stripe_promo_code_id / stripe_promo_code (populated only for discount type), max_uses, used_count, expires_at, status ('active'|'paused'|'deleted')
- `promotion_redemptions` — UNIQUE(promotion_id, redeemed_by_user_id); prevents double-redeem

## Server
- `server/routes/promotionRoutes.ts` — full CRUD + public preview + redeem
- Mounted at `/api/promotions` in routes.ts AND prod.ts
- requireProAccess guards create/list/pause/delete; redeem only needs requireAuth; preview is public

## Stripe integration
- discount type only: creates Stripe Coupon + PromotionCode at promotion creation time
- `stripeCheckout.ts` now accepts `stripePromoCodeId` — passes `discounts: [{ promotion_code: id }]` on the session; mutually exclusive with `allow_promotion_codes: true` (Stripe rejects both simultaneously)

## Trial extension
- Extended trial applies via raw SQL: `SET trial_ends_at = GREATEST(COALESCE(trial_ends_at, now()), now()) + interval 'X days'`
- Works for new users (no trial yet) and free-tier users (trial already expired)
- Does NOT touch subscribed users — the constraint is implicit (not enforced yet in code; may want to add later)

## Boot migration quirk
- `gen_random_bytes()` requires pgcrypto extension which is NOT available; invite_token default uses `md5(random()::text || clock_timestamp()::text)` instead

## Client
- `client/src/pages/business/PromotionsHub.tsx` — Business Center → Promotions (Pro+ gated via BusinessSuiteGate)
- `client/src/pages/PromoRedemption.tsx` — `/join/promo/:token` — full-screen, no shell, public
- `/join/promo` is in FULL_SCREEN_ROUTES (AppLayout.tsx) so it renders without desktop shell for all auth states

## Pending / deferred
- QR code generation for invite links
- Redemption analytics beyond `redemption_count` aggregate
- Auto-redeem on signup (currently only applies for already-authenticated users who hit redeem)
- Enforce "don't apply trial extension to already-subscribed users" at the server level
- The `stripePromoCodeId` needs to be surfaced to the checkout flow from the frontend (e.g. store in sessionStorage after redemption, pass to checkout page)

**Why:** Platform principle — One Promotion Engine. Everything that changes what a user receives flows through this single engine, not separate feature implementations.
