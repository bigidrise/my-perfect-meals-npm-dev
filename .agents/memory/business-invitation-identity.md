---
name: Business invitation identity
description: Product and security rules for connecting Organization clients through invitations.
---

An Organization client invitation is the connector. Existing My Perfect Meals members sign in to their existing account; new recipients create a normal account while preserving the same invitation context. Both converge on one server-authoritative acceptance path that creates or restores the canonical Organization and ProCare relationship.

Never create a duplicate account for an existing identity, build separate relationship systems for existing and new recipients, trust client-submitted Organization or professional IDs, or overwrite an existing paid personal subscription.

**Why:** Professionals should not need to know whether a recipient already uses My Perfect Meals, and identity duplication would fragment billing, history, consent, and ProCare relationships.

**How to apply:** Bind invitations to normalized email and persisted Organization/inviter context. Put bearer tokens only in URL fragments, scrub them into session storage immediately, and inspect or accept them through headers or POST bodies so request URLs and logs never contain them. Preserve the token through login or signup, consume it idempotently, and keep client capacity separate from professional team seats.