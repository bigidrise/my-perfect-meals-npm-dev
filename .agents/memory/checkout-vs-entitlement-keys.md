---
name: Checkout vs entitlement lookup keys
description: Two distinct plan-key unions — purchasable checkout SKUs vs historical entitlement keys — and why they must never be merged.
---

# Checkout vs entitlement lookup keys

**Rule:** `CheckoutLookupKey` (shared/planFeatures.ts) must contain exactly the keys that have a Stripe price in `STRIPE_PRICE_IDS` (server/config/stripePrices.ts). The broader `PlanLookupKey` union exists only for reading historical/entitlement metadata stored on user rows (legacy monthly keys, internal grants like `mpm_contributor`), and must never be accepted by `startCheckout`, StoreKit purchase paths, or upgrade CTAs.

**Why:** A completion review rejected a change that widened the checkout type to all plan keys — the compiler then demanded Stripe prices for 21 legacy/non-purchasable keys, and at runtime a user could be sent to checkout with a SKU Stripe doesn't sell. The two unions look similar but answer different questions: "what can be bought now" vs "what might a stored plan value be".

**How to apply:**
- Adding a new purchasable plan: add it to `CheckoutLookupKey`, `STRIPE_PRICE_IDS`, and the storefront SKU data together — the `Record<LookupKey, string>` type on the price map enforces this.
- Reading `user.planLookupKey`: treat it as the broad union (or plain string); legacy subscribers may carry `mpm_*_monthly` or `mpm_*_plan_*` keys with no current price.
- iOS products carry both: `internalSku` (purchasable key) plus `planLookupKeys` aliases so current-plan detection still matches legacy stored keys.
- `client/src/data/planSkus.ts` `LookupKey` is a deprecated alias of `CheckoutLookupKey`; don't re-fork it.
