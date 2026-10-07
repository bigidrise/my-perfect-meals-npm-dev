---
name: Care Team invitation parties
description: Identity ownership for bidirectional Care Team invitations and person-specific authorization checks.
---

Care Team invitations support both client-to-professional and professional-to-client directions. The invitation creator and the accepting actor are not fixed professional/client identities.

**Why:** Checking the invitation creator as a professional before resolving direction rejected legitimate client-created invitations as unsupported professional roles.

**How to apply:** Resolve both parties from persisted invitation and account evidence before provider-role, provider-access, consumer-eligibility, legal, or activation checks. Apply effective consumer access and client agreements to the actual client, even when the professional is the authenticated actor. Keep recipient email binding, expiry, organization attribution, and exact-relationship activation intact; never trust caller-supplied party IDs.
