---
name: Stripe entitlement authority
description: Durable ownership and identity rules for web subscription entitlement changes.
---

Stripe web subscriptions are authoritative only when verified from Stripe and tied to the immutable MPM user ID. Email and client-return data are never subscription identity or entitlement authority. Customer and subscription identities must be atomically claimed through one cross-table registry, including their personal-versus-business partition, before either state can bind them.

**Why:** A paid live subscription was not reflected in application state because no webhook endpoint existed, while several legacy paths could mutate access from weaker evidence.

**How to apply:** Route web billing changes through one signed raw-body webhook or authenticated server reconciliation. Use configured price IDs as the trusted SKU catalog, persist event idempotency and ordering, atomically claim all Stripe identities and the billing partition through the shared registry from every mutation path, and prevent development runtimes from processing live billing.