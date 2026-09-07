---
name: Stripe entitlement authority
description: Durable ownership and identity rules for web subscription entitlement changes.
---

Stripe web subscriptions are authoritative only when verified from Stripe and tied to the immutable MPM user ID. Email and client-return data are never subscription identity or entitlement authority. Customer and subscription identities must be atomically claimed through one cross-table registry, including their personal-versus-business partition, before either state can bind them.

**Why:** A paid live subscription was not reflected in application state because no webhook endpoint existed, while several legacy paths could mutate access from weaker evidence.

**How to apply:** Route web billing changes through one signed raw-body webhook or authenticated server reconciliation. Use configured price IDs as the trusted SKU catalog, persist event idempotency and ordering, atomically claim all Stripe identities and the billing partition through the shared registry from every mutation path, and prevent development runtimes from processing live billing.

Legacy cross-partition collisions must fail boot migration rather than be normalized from stored rows. Repair them only through Stripe-verified reconciliation, which atomically clears matching legacy fields while applying the authoritative business transition.

Consumer checkout must resolve one canonical Stripe customer before creating a subscription. Prefer the stored, ownership-claimed customer ID; otherwise use email only to discover candidates and require the immutable MPM user ID on Customer, Subscription, or Checkout Session metadata. Multiple verified candidates fail closed for manual review.

**Why:** A live account completed four paid Checkout Sessions because consumer checkout neither reused a customer nor checked Stripe for an existing active subscription, while failed webhook signatures left local entitlement stale.

**How to apply:** Before Checkout creation, persist the canonical customer through the ownership registry, check stored and Stripe-authoritative active/trialing subscriptions, self-heal verified stale state, and use server-side customer and Checkout idempotency keys.