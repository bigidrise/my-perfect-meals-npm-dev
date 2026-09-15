---
name: Organization-owned Rewardful identity
description: Ownership, reconciliation, and delegated-access rules for organization Partner & Revenue accounts.
---

Rewardful affiliate identity, referral data, setup state, and Partner & Revenue history belong to the permanent organization UUID.

Organization attribution must be inherited through every client acquisition path: active workspace or exact Studio organization binding → invitation → acceptance → client relationship → future paid conversion. Bulk rows share the server-resolved workspace identity. Providers and coordinators never re-enter referral codes per invitation.

**Why:** One person can administer multiple independent organizations, and an outside contractor can leave without taking a clinic's identity. Rewardful's email-based integration cannot deterministically distinguish organizations sharing an operator.

**How to apply:** Use an organization-owned business contact email for new setup. Existing accounts may be discovered by exact Rewardful email only inside an authorized organization workflow, but discovery never authorizes attachment. Require an expiring, single-use confirmation sent to the Rewardful email and revalidate organization authority, affiliate ID/email, lifecycle, and cross-organization uniqueness before attachment. Keep the exact affiliate ID path as a recovery fallback. Resolve invitation attribution server-side from the exact selected organization/location or an exact Studio binding, persist it through acceptance and the resulting relationship, and fail multi-organization ambiguity instead of inferring from operator email, user ID, or legacy organization fields. Keep external delegated administrators distinct from internal staff, and preserve organization data when either relationship is revoked.