---
name: Professional legal activation boundary
description: Governs consent, activation, and recovery for ProCare professional accounts.
---

Professional signup intent must not directly activate ProCare. The authenticated upgrade boundary activates professional access only after current versioned attestation and role-specific agreements have been explicitly accepted.

**Why:** Historical signup paths could mark professionals active without legal acceptance records, leaving downstream Studio gates to discover the inconsistency after access had already been granted. Acceptance must never be fabricated or administratively backfilled.

**How to apply:** Require both attestation and the professional/physician document flow for every provider-originated Studio or client-invite action. Existing accounts recover through the same explicit UI, using the authenticated role and a safe same-origin return destination for the interrupted action.