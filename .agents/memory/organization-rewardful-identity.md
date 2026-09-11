---
name: Organization-owned Rewardful identity
description: Ownership, reconciliation, and delegated-access rules for organization Partner & Revenue accounts.
---

Rewardful affiliate identity, referral data, setup state, and Partner & Revenue history belong to the permanent organization UUID.

**Why:** One person can administer multiple independent organizations, and an outside contractor can leave without taking a clinic's identity. Rewardful's email-based integration cannot deterministically distinguish organizations sharing an operator.

**How to apply:** Use an organization-owned business contact email for new setup. Existing accounts may be discovered by exact Rewardful email only inside an authorized organization workflow, but discovery never authorizes attachment. Require an expiring, single-use confirmation sent to the Rewardful email and revalidate organization authority, affiliate ID/email, lifecycle, and cross-organization uniqueness before attachment. Keep the exact affiliate ID path as a recovery fallback. Never reconcile by operator email or user ID. Keep external delegated administrators distinct from internal staff, and preserve organization data when either relationship is revoked.