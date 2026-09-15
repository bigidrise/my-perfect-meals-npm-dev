---
name: Business Offer link boundary
description: Ownership, access, and attribution rules for reusable organization offers.
---

Reusable Business Offer links are organization/location-owned records, separate from personal promotions and one-person invitations. MPM owns the bounded complimentary-access entitlement; Rewardful owns affiliate attribution.

**Why:** Organization authorization, reusable anonymous distribution, entitlement provenance, and affiliate credit have different invariants from personal promotions and client invitations. Combining them would allow tenant or attribution state to leak across product boundaries.

**How to apply:** Derive organization, location, duration, and affiliate identity server-side. Use opaque public tokens, atomic one-redemption-per-user grants, and immutable entitlement snapshots. Validate checkout referral IDs against the persisted Rewardful affiliate.