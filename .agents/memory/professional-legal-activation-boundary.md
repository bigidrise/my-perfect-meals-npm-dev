---
name: Professional legal activation boundary
description: Governs consent, activation, and recovery for ProCare professional accounts.
---

Professional signup intent must not directly activate ProCare. Require explicit
current-version attestation and role-specific agreements without treating legal
consent as paid entitlement authority. Preserve the separate
[Stripe entitlement authority](stripe-entitlement-authority.md); do not revive
retired self-upgrade behavior from an older task's activation sequence.

**Why:** Historical signup paths could mark professionals active without legal acceptance records, leaving downstream Studio gates to discover the inconsistency after access had already been granted. Acceptance must never be fabricated or administratively backfilled. Later billing hardening retired self-upgrade, so older task descriptions do not establish the current activation design.

**How to apply:** Require both attestation and the professional/physician document flow for every provider-originated Studio or client-invite action. Existing accounts recover through the same explicit UI, using the authenticated role and a safe same-origin return destination for the interrupted action.