---
name: Care Team invitation parties
description: Identity ownership for bidirectional Care Team invitations and person-specific authorization checks.
---

Care Team invitations support both client-to-professional and professional-to-client directions. The invitation creator and the accepting actor are not fixed professional/client identities.

**Why:** Checking the invitation creator as a professional before resolving direction rejected legitimate client-created invitations as unsupported professional roles.

**How to apply:** Resolve both parties from persisted invitation and account evidence before provider-role, provider-access, consumer-eligibility, legal, or activation checks. Apply effective consumer access and client agreements to the actual client, even when the professional is the authenticated actor. Keep recipient email binding, expiry, organization attribution, and exact-relationship activation intact; never trust caller-supplied party IDs.

Accepted invitations are receipts for an exact active relationship, not authority to restore a disconnected relationship. A provider accepting a client-created invitation must not receive that client's membership or Care Team card as their own personal membership.

**Why:** Acceptance previously inverted the parties and could display another subject's relationship in the accepting professional's personal UI.

**How to apply:** Use the same canonical acceptance policy for codes, links, and unambiguous legacy tokenless login invitations. Preserve explicit confirmation for email-token links; do not consume competing invitations. Keep synthetic-case simulation separate from live users, email, relationships, and commercial grants, and label simulated client acceptance honestly.
