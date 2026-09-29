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

Every subscription checkout path needs a durable server reservation scoped to the exact billing subject. ProCare reservations belong to the exact client-professional relationship; reuse or rotation requires matching customer, user, relationship, session, and reservation metadata.

**Why:** Client-only pending state and Stripe idempotency windows do not serialize concurrent tabs or protect legacy subscriptions on older customer records.

**How to apply:** Check all retained subscription IDs against Stripe, atomically reserve before Checkout creation, derive session idempotency from that reservation, and rotate terminal sessions only after authoritative active/trialing checks.

The signed raw-body webhook should be mounted before general application readiness, but it must return a retryable non-2xx response until controlled startup has asserted the billing ledger schema. Webhook requests must never run schema DDL.

**Why:** Long boot migrations can prevent Stripe delivery from reaching the canonical handler, while request-time DDL creates lock and latency risk. Early routing without an explicit ledger gate can instead expose missing-schema failures.

**How to apply:** Verify signatures before the readiness response, mark billing readiness only after controlled migration and schema assertion, and ensure every persistence rejection completes with a retryable response under the deployed Express version.

An event claimed but not completed is not an idempotent success. Never acknowledge a concurrent or stranded processing claim as delivered, and never let a cancellation or late event for an older subscription replace the account's currently selected billing identity.

**Why:** A process can die after claiming an event but before granting access; a successful retry acknowledgement would then strand a paid customer. Duplicate subscriptions also produce legitimate late events that must not revoke the retained subscription.

**How to apply:** Keep retries non-2xx until the event is completed or safely reclaimed, and condition entitlement writes and revocations on the exact currently owned customer/subscription pair. Report unresolved multi-customer histories for human review rather than choosing a newer identity automatically.

Verified service billing evidence and paid access must change together for every adverse provider event, including subscription-status updates that arrive without an invoice. Historical terminal evidence may outlive the account's current subscription binding, but requires an already verified service record and exact immutable ownership claims. Offline backfill has lower ordering authority than every signed provider event, regardless of when the backfill fetch ran.

**Why:** A status-only snapshot could report payment trouble while the same workspace remained authorized; a late terminal event could miss an already-cleared current binding; locally timed backfills could supersede fresher webhook truth.

**How to apply:** Attach snapshot writes to accepted entitlement transactions and keep failed writes retryable. For terminal history, verify existing provenance instead of inferring from metadata. Never let a backfill timestamp outrank a webhook's event watermark.